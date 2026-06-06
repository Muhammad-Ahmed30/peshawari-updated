const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const DB_DIR = path.join(ROOT, 'database');
const DB_FILE = path.join(DB_DIR, 'db.json');

const defaultMenu = [
  { id: 1, name: 'Peshawari Chapli Kabab', cat: 'Kabab', price: 360, img: 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?auto=format&fit=crop&w=900&q=80', desc: 'Hand-pressed beef kabab with tomatoes, coriander, and house spices.' },
  { id: 2, name: 'Beef BBQ Platter', cat: 'BBQ', price: 1450, img: 'https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?auto=format&fit=crop&w=900&q=80', desc: 'Seekh kabab, boti, tikka, chutney, raita, and naan.' },
  { id: 3, name: 'Mutton Karahi', cat: 'Karahi', price: 2450, img: 'https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=900&q=80', desc: 'Tomato, green chilli, ginger, and slow-cooked mutton.' }
];

const defaultDb = {
  menu: defaultMenu,
  orders: [],
  reservations: [],
  customers: [],
  offers: [
    { code: 'A1WELCOME', type: 'percent', value: 8, min: 0 },
    { code: 'BBQ10', type: 'category', value: 10, category: 'BBQ' },
    { code: 'FAMILY15', type: 'percent', value: 15, min: 3000 }
  ],
  admin: {
    username: 'admin',
    passwordHash: sha256('a1admin')
  }
};

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  if (!fs.existsSync(DB_FILE)) {
    fs.writeFileSync(DB_FILE, JSON.stringify(defaultDb, null, 2));
  }
}

function readDb() {
  ensureDb();
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDb(db) {
  ensureDb();
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

function send(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization'
  });
  res.end(JSON.stringify(data));
}

function notFound(res) {
  send(res, 404, { error: 'Not found' });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', chunk => {
      raw += chunk;
      if (raw.length > 1_000_000) {
        req.destroy();
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch (error) {
        reject(error);
      }
    });
  });
}

function nextId(prefix, items) {
  return `${prefix}-${String(items.length + 1).padStart(4, '0')}`;
}

function analytics(db) {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);
  const totalSales = db.orders.reduce((sum, order) => sum + Number(order.total || 0), 0);
  const dailySales = db.orders
    .filter(order => String(order.date || '').slice(0, 10) === today)
    .reduce((sum, order) => sum + Number(order.total || 0), 0);
  const monthlySales = db.orders
    .filter(order => String(order.date || '').slice(0, 7) === month)
    .reduce((sum, order) => sum + Number(order.total || 0), 0);

  return {
    orders: db.orders.length,
    reservations: db.reservations.length,
    customers: db.customers.length,
    totalSales,
    dailySales,
    monthlySales
  };
}

function serveFile(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (url.pathname === '/admin') {
    res.writeHead(302, { Location: '/?admin=1#admin' });
    res.end();
    return;
  }
  const requested = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));

  if (!filePath.startsWith(ROOT)) return notFound(res);
  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) return notFound(res);

  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp'
  };

  res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
}

async function handleApi(req, res) {
  const db = readDb();
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (req.method === 'OPTIONS') return send(res, 200, { ok: true });
  if (req.method === 'GET' && pathname === '/api/health') return send(res, 200, { ok: true, name: 'A-1 Peshawari API' });
  if (req.method === 'GET' && pathname === '/api/state') {
    return send(res, 200, {
      menu: db.menu,
      orders: db.orders,
      reservations: db.reservations,
      customers: db.customers,
      offers: db.offers,
      analytics: analytics(db)
    });
  }

  if (req.method === 'POST' && pathname === '/api/state') {
    const body = await parseBody(req);
    db.menu = Array.isArray(body.menu) ? body.menu : db.menu;
    db.orders = Array.isArray(body.orders) ? body.orders : db.orders;
    db.reservations = Array.isArray(body.reservations) ? body.reservations : db.reservations;
    db.customers = Array.isArray(body.customers) ? body.customers : db.customers;
    writeDb(db);
    return send(res, 200, { ok: true, analytics: analytics(db) });
  }

  if (req.method === 'POST' && pathname === '/api/auth/login') {
    const body = await parseBody(req);
    const valid = body.username === db.admin.username && sha256(body.password) === db.admin.passwordHash;
    return valid
      ? send(res, 200, { ok: true, token: 'demo-admin-token' })
      : send(res, 401, { ok: false, error: 'Invalid credentials' });
  }

  if (req.method === 'GET' && pathname === '/api/menu') return send(res, 200, db.menu);
  if (req.method === 'POST' && pathname === '/api/menu') {
    const body = await parseBody(req);
    const item = { id: Date.now(), name: body.name, price: Number(body.price), cat: body.cat || 'Special', img: body.img || '', desc: body.desc || '' };
    if (!item.name || !item.price) return send(res, 400, { error: 'Name and price are required' });
    db.menu.push(item);
    writeDb(db);
    return send(res, 201, item);
  }

  const menuMatch = pathname.match(/^\/api\/menu\/(.+)$/);
  if (menuMatch && req.method === 'PUT') {
    const body = await parseBody(req);
    const id = Number(menuMatch[1]);
    const item = db.menu.find(entry => Number(entry.id) === id);
    if (!item) return notFound(res);
    Object.assign(item, body, body.price ? { price: Number(body.price) } : {});
    writeDb(db);
    return send(res, 200, item);
  }
  if (menuMatch && req.method === 'DELETE') {
    const id = Number(menuMatch[1]);
    db.menu = db.menu.filter(entry => Number(entry.id) !== id);
    writeDb(db);
    return send(res, 200, { ok: true });
  }

  if (req.method === 'GET' && pathname === '/api/orders') return send(res, 200, db.orders);
  if (req.method === 'POST' && pathname === '/api/orders') {
    const body = await parseBody(req);
    const order = { ...body, id: body.id || nextId('A1', db.orders), date: body.date || new Date().toISOString(), status: body.status || 'Pending' };
    db.orders.unshift(order);
    db.customers.unshift({ name: order.customer, phone: order.phone, lastOrder: order.id, total: order.total || 0 });
    writeDb(db);
    return send(res, 201, order);
  }

  const orderStatusMatch = pathname.match(/^\/api\/orders\/([^/]+)\/status$/);
  if (orderStatusMatch && req.method === 'PUT') {
    const body = await parseBody(req);
    const order = db.orders.find(entry => entry.id === orderStatusMatch[1]);
    if (!order) return notFound(res);
    order.status = body.status || order.status;
    writeDb(db);
    return send(res, 200, order);
  }

  if (req.method === 'GET' && pathname === '/api/reservations') return send(res, 200, db.reservations);
  if (req.method === 'POST' && pathname === '/api/reservations') {
    const body = await parseBody(req);
    const reservation = { ...body, id: body.id || nextId('R', db.reservations), status: body.status || 'Confirmed' };
    db.reservations.unshift(reservation);
    writeDb(db);
    return send(res, 201, reservation);
  }

  if (req.method === 'GET' && pathname === '/api/customers') return send(res, 200, db.customers);
  if (req.method === 'GET' && pathname === '/api/analytics') return send(res, 200, analytics(db));

  notFound(res);
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith('/api/')) return await handleApi(req, res);
    serveFile(req, res);
  } catch (error) {
    send(res, 500, { error: error.message || 'Server error' });
  }
});

server.listen(PORT, () => {
  ensureDb();
  console.log(`A-1 Peshawari website running at http://localhost:${PORT}`);
  console.log(`Admin login: admin / a1admin`);
});

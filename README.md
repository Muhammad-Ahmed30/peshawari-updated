# A-1 Peshawari Restaurant Website

## Run Locally

```bash
npm start
```

Then open:

```text
http://localhost:3000
```

## Admin Login

```text
Username: admin
Password: a1admin
```

## API Routes

- `GET /api/health`
- `GET /api/state`
- `POST /api/state`
- `POST /api/auth/login`
- `GET /api/menu`
- `POST /api/menu`
- `PUT /api/menu/:id`
- `DELETE /api/menu/:id`
- `GET /api/orders`
- `POST /api/orders`
- `PUT /api/orders/:id/status`
- `GET /api/reservations`
- `POST /api/reservations`
- `GET /api/customers`
- `GET /api/analytics`

## Notes

This backend uses `database/db.json` as a simple local database. It is good for demo and small local use. For production, replace it with Firebase, Supabase, MongoDB, PostgreSQL, or MySQL.

JazzCash, Easypaisa, and card payments still require merchant credentials and official payment gateway setup.

# API Application

Express REST API for the dynamic event ticketing platform.

```bash
pnpm --filter api dev
pnpm --filter api test
pnpm --filter api check-types
```

The booking endpoint uses a Postgres transaction with `SELECT ... FOR UPDATE`
to prevent overselling.

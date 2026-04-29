# Dynamic Event Ticketing Platform

A full-stack event ticketing platform with dynamic pricing, built with Turborepo, Next.js 15, Express, PostgreSQL, Drizzle ORM, and TypeScript.

## Prerequisites

- Node.js 20 recommended, Node.js 18 minimum
- pnpm 9
- Docker, or a local PostgreSQL database

## Setup

```bash
pnpm install
docker compose up -d
cp .env.example .env
pnpm db:push
pnpm db:seed
```

The default `.env.example` points to `postgresql://postgres:postgres@localhost:5432/ticketing`. If you use your own database, update `DATABASE_URL`.

## Run

```bash
pnpm dev
```

- Web: http://localhost:3000
- API: http://localhost:3001

## API Endpoints

- `GET /events`
- `GET /events/:id`
- `POST /events` with `x-api-key` when `ADMIN_API_KEY` is set
- `POST /bookings`
- `GET /bookings?eventId=:id`
- `GET /analytics/events/:id`
- `GET /analytics/summary`
- `POST /seed`

## Tests

```bash
pnpm test
```

Pricing unit tests run without external services and currently exceed the required 70% pricing coverage. API integration and concurrency tests run when `TEST_DATABASE_URL` or `DATABASE_URL` is available to the API test process.

To run the database-backed API tests explicitly:

```bash
cd apps/api
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticketing_test pnpm test
```

## Environment Variables

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticketing
TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ticketing_test
PORT=3001
NODE_ENV=development
NEXT_PUBLIC_API_URL=http://localhost:3001
ADMIN_API_KEY=dev-admin-key
TIME_RULE_WEIGHT=1
DEMAND_RULE_WEIGHT=1
INVENTORY_RULE_WEIGHT=1
```

## Monorepo Structure

- `apps/web`: Next.js 15 App Router frontend
- `apps/api`: Express REST API
- `packages/database`: Drizzle schema, database client, seed script
- `packages/pricing-engine`: deterministic dynamic pricing logic and unit tests
- `packages/ui`: starter shared UI package

## Pricing Rules

The pricing engine calculates:

```text
currentPrice = basePrice * (1 + sum(weighted adjustments))
```

- Time: `+20%` within 7 days, `+50%` within 1 day
- Demand: `+15%` when more than 10 bookings happened in the last hour
- Inventory: `+25%` when fewer than 20% of tickets remain
- Final price is clamped between `floorPrice` and `ceilingPrice`

## Concurrency

`POST /bookings` uses a Postgres transaction and `SELECT ... FOR UPDATE` on the event row before checking availability and updating `booked_tickets`. This prevents overselling when simultaneous requests compete for the final tickets.

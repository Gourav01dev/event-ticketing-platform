import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import app, { createBooking } from "../src/app";
import { sql } from "@repo/database";

const hasDatabase = Boolean(process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL);
const describeWithDb = hasDatabase ? describe : describe.skip;

describe("api app", () => {
  it("responds to health checks", async () => {
    const response = await request(app).get("/health").expect(200);
    expect(response.body).toEqual({ ok: true });
  });
});

describeWithDb("booking flow", () => {
  beforeAll(async () => {
    await sql`
      create table if not exists events (
        id uuid primary key default gen_random_uuid(),
        name varchar(180) not null,
        date timestamptz not null,
        venue varchar(220) not null,
        description varchar(2000) not null,
        total_tickets integer not null,
        booked_tickets integer not null default 0,
        base_price numeric(10, 2) not null,
        current_price numeric(10, 2) not null,
        floor_price numeric(10, 2) not null,
        ceiling_price numeric(10, 2) not null,
        pricing_rules jsonb not null default '{}',
        created_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `;
    await sql`
      create table if not exists bookings (
        id uuid primary key default gen_random_uuid(),
        event_id uuid not null references events(id) on delete cascade,
        user_email varchar(320) not null,
        quantity integer not null,
        price_paid numeric(10, 2) not null,
        created_at timestamptz not null default now()
      )
    `;
  });

  beforeEach(async () => {
    await sql`delete from bookings`;
    await sql`delete from events`;
  });

  afterAll(async () => {
    await sql.end();
  });

  it("books tickets from price calculation through confirmation data", async () => {
    const eventId = await createEvent({ totalTickets: 5, bookedTickets: 0 });

    const bookingResponse = await request(app)
      .post("/bookings")
      .send({
        eventId,
        userEmail: "buyer@example.com",
        quantity: 2,
      })
      .expect(201);

    expect(bookingResponse.body.booking.pricePaid).toBeGreaterThan(0);

    const listResponse = await request(app)
      .get(`/bookings?eventId=${eventId}`)
      .expect(200);

    expect(listResponse.body.bookings).toHaveLength(1);
    expect(listResponse.body.bookings[0].quantity).toBe(2);
  });

  it("prevents overbooking of the last ticket with concurrent requests", async () => {
    const eventId = await createEvent({ totalTickets: 1, bookedTickets: 0 });

    const results = await Promise.allSettled([
      createBooking({
        eventId,
        userEmail: "one@example.com",
        quantity: 1,
      }),
      createBooking({
        eventId,
        userEmail: "two@example.com",
        quantity: 1,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === "fulfilled");
    const rejected = results.filter((result) => result.status === "rejected");

    const [event] = await sql`
      select booked_tickets from events where id = ${eventId}
    `;
    const [bookingCount] = await sql`
      select count(*)::int as count from bookings where event_id = ${eventId}
    `;

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(Number(event.booked_tickets)).toBe(1);
    expect(Number(bookingCount.count)).toBe(1);
  });
});

async function createEvent(input: {
  totalTickets: number;
  bookedTickets: number;
}): Promise<string> {
  const [event] = await sql`
    insert into events (
      name, date, venue, description, total_tickets, booked_tickets,
      base_price, current_price, floor_price, ceiling_price, pricing_rules
    )
    values (
      'Test Event', ${new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString()}::timestamptz,
      'Test Venue', 'Integration test event', ${input.totalTickets},
      ${input.bookedTickets}, 100, 100, 50, 250, '{}'
    )
    returning id
  `;

  return String(event.id);
}

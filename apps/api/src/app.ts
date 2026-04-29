import "dotenv/config";
import cors from "cors";
import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import { sql } from "@repo/database";
import { calculateEventPrice, toNumber } from "./pricing";

const app: Express = express();
type SqlRow = Record<string, unknown>;

app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }));
app.use(express.json());

const asyncRoute =
  (handler: (req: Request, res: Response) => Promise<void>) =>
  (req: Request, res: Response, next: NextFunction) => {
    handler(req, res).catch(next);
  };

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});


app.get(
  "/events",
  asyncRoute(async (_req, res) => {
    const rows = await sql`
      select e.*,
        count(b.id) filter (where b.created_at > now() - interval '1 hour')::int as recent_bookings_count
      from events e
      left join bookings b on b.event_id = e.id
      group by e.id
      order by e.date asc
    `;

    const events = await Promise.all(
      rows.map(async (event) => {
        const breakdown = calculateEventPrice(
          event as SqlRow,
          Number(event.recent_bookings_count),
        );
        await updateCurrentPrice(event.id, breakdown.finalPrice);

        return serializeEvent(event, breakdown.finalPrice);
      }),
    );

    res.json({ events });
  }),
);

app.get(
  "/events/:id",
  asyncRoute(async (req, res) => {
    const eventId = req.params.id;
    if (!eventId) {
      res.status(400).json({ error: "Event id is required" });
      return;
    }

    const [event] = await sql`
      select e.*,
        count(b.id) filter (where b.created_at > now() - interval '1 hour')::int as recent_bookings_count
      from events e
      left join bookings b on b.event_id = e.id
      where e.id = ${eventId}
      group by e.id
    `;

    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const breakdown = calculateEventPrice(
      event as SqlRow,
      Number(event.recent_bookings_count),
    );
    await updateCurrentPrice(event.id, breakdown.finalPrice);

    res.json({
      event: serializeEvent(event, breakdown.finalPrice),
      priceBreakdown: breakdown,
    });
  }),
);

app.post(
  "/events",
  asyncRoute(async (req, res) => {
    if (process.env.ADMIN_API_KEY && req.header("x-api-key") !== process.env.ADMIN_API_KEY) {
      res.status(401).json({ error: "Invalid admin API key" });
      return;
    }

    const body = req.body as Record<string, unknown>;
    const basePrice = Number(body.basePrice);
    const [event] = await sql`
      insert into events (
        name, date, venue, description, total_tickets, booked_tickets,
        base_price, current_price, floor_price, ceiling_price, pricing_rules
      )
      values (
        ${String(body.name)}, ${new Date(String(body.date)).toISOString()}::timestamptz, ${String(body.venue)},
        ${String(body.description ?? "")}, ${Number(body.totalTickets)}, 0,
        ${basePrice}, ${basePrice}, ${Number(body.floorPrice)}, ${Number(body.ceilingPrice)},
        ${sql.json(JSON.parse(JSON.stringify(body.pricingRules ?? {})))}
      )
      returning *
    `;

    if (!event) {
      throw new Error("Event creation failed");
    }

    res.status(201).json({ event: serializeEvent(event, toNumber(event.current_price)) });
  }),
);

app.post(
  "/bookings",
  asyncRoute(async (req, res) => {
    const { eventId, userEmail, quantity } = req.body as {
      eventId?: string;
      userEmail?: string;
      quantity?: number;
    };

    if (!eventId || !userEmail || !quantity || quantity < 1) {
      res.status(400).json({ error: "eventId, userEmail, and quantity are required" });
      return;
    }

    const booking = await createBooking({ eventId, userEmail, quantity });
    res.status(201).json({ booking });
  }),
);

app.get(
  "/bookings",
  asyncRoute(async (req, res) => {
    const eventId = typeof req.query.eventId === "string" ? req.query.eventId : undefined;
    const userEmail =
      typeof req.query.userEmail === "string" ? req.query.userEmail : undefined;

    const rows =
      eventId && userEmail
        ? await sql`
            select b.*, e.name as event_name, e.current_price
            from bookings b join events e on e.id = b.event_id
            where b.event_id = ${eventId} and b.user_email = ${userEmail}
            order by b.created_at desc
          `
        : eventId
          ? await sql`
              select b.*, e.name as event_name, e.current_price
              from bookings b join events e on e.id = b.event_id
              where b.event_id = ${eventId}
              order by b.created_at desc
            `
          : userEmail
            ? await sql`
                select b.*, e.name as event_name, e.current_price
                from bookings b join events e on e.id = b.event_id
                where b.user_email = ${userEmail}
                order by b.created_at desc
              `
            : await sql`
                select b.*, e.name as event_name, e.current_price
                from bookings b join events e on e.id = b.event_id
                order by b.created_at desc
              `;

    res.json({ bookings: rows.map(serializeBooking) });
  }),
);

app.get(
  "/analytics/events/:id",
  asyncRoute(async (req, res) => {
    const eventId = req.params.id;
    if (!eventId) {
      res.status(400).json({ error: "Event id is required" });
      return;
    }

    const [event] = await sql`select * from events where id = ${eventId}`;
    if (!event) {
      res.status(404).json({ error: "Event not found" });
      return;
    }

    const [metrics] = await sql`
      select
        coalesce(sum(quantity), 0)::int as total_sold,
        coalesce(sum(quantity * price_paid), 0)::numeric as revenue,
        coalesce(avg(price_paid), 0)::numeric as average_price
      from bookings
      where event_id = ${eventId}
    `;

    res.json({
      eventId,
      totalSold: Number(metrics?.total_sold ?? 0),
      revenue: toNumber(metrics?.revenue ?? 0),
      averagePrice: toNumber(metrics?.average_price ?? 0),
      remaining: Number(event.total_tickets) - Number(event.booked_tickets),
    });
  }),
);

app.get(
  "/analytics/summary",
  asyncRoute(async (_req, res) => {
    const [metrics] = await sql`
      select
        (select count(*)::int from events) as total_events,
        coalesce(sum(quantity), 0)::int as total_tickets_sold,
        coalesce(sum(quantity * price_paid), 0)::numeric as total_revenue
      from bookings
    `;

    res.json({
      totalEvents: Number(metrics?.total_events ?? 0),
      totalTicketsSold: Number(metrics?.total_tickets_sold ?? 0),
      totalRevenue: toNumber(metrics?.total_revenue ?? 0),
    });
  }),
);

app.post(
  "/seed",
  asyncRoute(async (_req, res) => {
    const { seedDatabase } = await import("./seed-helper");
    await seedDatabase();
    res.json({ ok: true });
  }),
);

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected error";
  const status = message.includes("Not enough tickets") ? 409 : 500;
  res.status(status).json({ error: message });
});

export async function createBooking(input: {
  eventId: string;
  userEmail: string;
  quantity: number;
}) {
  return sql.begin(async (tx) => {
    const [event] = await tx`
      select * from events
      where id = ${input.eventId}
      for update
    `;

    if (!event) {
      throw new Error("Event not found");
    }

    const remaining = Number(event.total_tickets) - Number(event.booked_tickets);
    if (remaining < input.quantity) {
      throw new Error(`Not enough tickets available. ${remaining} remaining.`);
    }

    const [recent] = await tx`
      select count(*)::int as count
      from bookings
      where event_id = ${input.eventId}
        and created_at > now() - interval '1 hour'
    `;
    const breakdown = calculateEventPrice(event as SqlRow, Number(recent?.count ?? 0));
    const pricePaid = breakdown.finalPrice;

    const [booking] = await tx`
      insert into bookings (event_id, user_email, quantity, price_paid)
      values (${input.eventId}, ${input.userEmail}, ${input.quantity}, ${pricePaid})
      returning *
    `;

    const bookedTickets = Number(event.booked_tickets) + input.quantity;
    await tx`
      update events
      set booked_tickets = ${bookedTickets},
          current_price = ${pricePaid},
          updated_at = now()
      where id = ${input.eventId}
    `;

    if (!booking) {
      throw new Error("Booking creation failed");
    }

    return serializeBooking(booking);
  });
}

async function updateCurrentPrice(eventId: string, currentPrice: number) {
  await sql`
    update events
    set current_price = ${currentPrice}, updated_at = now()
    where id = ${eventId}
  `;
}

function serializeEvent(event: Record<string, unknown>, currentPrice: number) {
  const totalTickets = Number(event.total_tickets);
  const bookedTickets = Number(event.booked_tickets);

  return {
    id: event.id,
    name: event.name,
    date: event.date,
    venue: event.venue,
    description: event.description,
    totalTickets,
    bookedTickets,
    remainingTickets: totalTickets - bookedTickets,
    basePrice: toNumber(event.base_price),
    currentPrice,
    floorPrice: toNumber(event.floor_price),
    ceilingPrice: toNumber(event.ceiling_price),
    pricingRules: event.pricing_rules,
    createdAt: event.created_at,
    updatedAt: event.updated_at,
  };
}

function serializeBooking(booking: Record<string, unknown>) {
  return {
    id: booking.id,
    eventId: booking.event_id,
    eventName: booking.event_name,
    userEmail: booking.user_email,
    quantity: Number(booking.quantity),
    pricePaid: toNumber(booking.price_paid),
    currentPrice: toNumber(booking.current_price),
    createdAt: booking.created_at,
  };
}

export default app;

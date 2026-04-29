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
import { ApiError, asyncRoute } from "./http";

const app: Express = express();
type SqlRow = Record<string, unknown>;

app.use(cors({ origin: process.env.CORS_ORIGIN ?? true }));
app.use(express.json());

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
    const eventId = requireString(req.params.id, "Event id is required");

    const [event] = await sql`
      select e.*,
        count(b.id) filter (where b.created_at > now() - interval '1 hour')::int as recent_bookings_count
      from events e
      left join bookings b on b.event_id = e.id
      where e.id = ${eventId}
      group by e.id
    `;

    if (!event) {
      throw new ApiError(404, "Event not found", "NOT_FOUND");
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
      throw new ApiError(401, "Invalid admin API key", "UNAUTHORIZED");
    }

    const body = req.body as Record<string, unknown>;
    const payload = validateEventPayload(body);
    const [event] = await sql`
      insert into events (
        name, date, venue, description, total_tickets, booked_tickets,
        base_price, current_price, floor_price, ceiling_price, pricing_rules
      )
      values (
        ${payload.name}, ${payload.date.toISOString()}::timestamptz, ${payload.venue},
        ${payload.description}, ${payload.totalTickets}, 0,
        ${payload.basePrice}, ${payload.basePrice}, ${payload.floorPrice}, ${payload.ceilingPrice},
        ${sql.json(payload.pricingRules)}
      )
      returning *
    `;

    if (!event) {
      throw new ApiError(500, "Event creation failed", "INTERNAL_ERROR");
    }

    res.status(201).json({ event: serializeEvent(event, toNumber(event.current_price)) });
  }),
);

app.post(
  "/bookings",
  asyncRoute(async (req, res) => {
    const { eventId, userEmail, quantity } = validateBookingPayload(
      req.body as Record<string, unknown>,
    );

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
    const eventId = requireString(req.params.id, "Event id is required");

    const [event] = await sql`select * from events where id = ${eventId}`;
    if (!event) {
      throw new ApiError(404, "Event not found", "NOT_FOUND");
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

app.use((_req, _res, next) => {
  next(new ApiError(404, "Route not found", "NOT_FOUND"));
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ApiError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      details: error.details,
    });
    return;
  }

  if (error instanceof SyntaxError && "body" in error) {
    res.status(400).json({
      error: "Malformed JSON request body",
      code: "BAD_REQUEST",
    });
    return;
  }

  console.error(error);
  res.status(500).json({
    error: "Internal server error",
    code: "INTERNAL_ERROR",
  });
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
      throw new ApiError(404, "Event not found", "NOT_FOUND");
    }

    const remaining = Number(event.total_tickets) - Number(event.booked_tickets);
    if (remaining < input.quantity) {
      throw new ApiError(
        409,
        `Not enough tickets available. ${remaining} remaining.`,
        "CONFLICT",
        { remaining },
      );
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
      throw new ApiError(500, "Booking creation failed", "INTERNAL_ERROR");
    }

    return serializeBooking(booking);
  });
}

function validateBookingPayload(body: Record<string, unknown>) {
  const eventId = requireString(body.eventId, "eventId is required");
  const userEmail = requireEmail(body.userEmail);
  const quantity = requirePositiveInteger(body.quantity, "quantity");

  return { eventId, userEmail, quantity };
}

function validateEventPayload(body: Record<string, unknown>) {
  const name = requireString(body.name, "name is required");
  const venue = requireString(body.venue, "venue is required");
  const description =
    typeof body.description === "string" ? body.description : "";
  const totalTickets = requirePositiveInteger(body.totalTickets, "totalTickets");
  const basePrice = requirePositiveNumber(body.basePrice, "basePrice");
  const floorPrice = requirePositiveNumber(body.floorPrice, "floorPrice");
  const ceilingPrice = requirePositiveNumber(body.ceilingPrice, "ceilingPrice");
  const date = new Date(requireString(body.date, "date is required"));

  if (Number.isNaN(date.getTime())) {
    throw new ApiError(400, "date must be a valid ISO date", "BAD_REQUEST");
  }

  if (floorPrice > basePrice || basePrice > ceilingPrice) {
    throw new ApiError(
      400,
      "pricing must satisfy floorPrice <= basePrice <= ceilingPrice",
      "BAD_REQUEST",
      { floorPrice, basePrice, ceilingPrice },
    );
  }

  return {
    name,
    venue,
    description,
    totalTickets,
    basePrice,
    floorPrice,
    ceilingPrice,
    date,
    pricingRules: JSON.parse(JSON.stringify(body.pricingRules ?? {})),
  };
}

function requireString(value: unknown, message: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new ApiError(400, message, "BAD_REQUEST");
  }

  return value.trim();
}

function requireEmail(value: unknown): string {
  const email = requireString(value, "userEmail is required");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ApiError(400, "userEmail must be a valid email", "BAD_REQUEST");
  }

  return email;
}

function requirePositiveInteger(value: unknown, field: string): number {
  const numberValue = Number(value);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new ApiError(400, `${field} must be a positive integer`, "BAD_REQUEST");
  }

  return numberValue;
}

function requirePositiveNumber(value: unknown, field: string): number {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) {
    throw new ApiError(400, `${field} must be a positive number`, "BAD_REQUEST");
  }

  return numberValue;
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

import {
  calculatePrice,
  weightsFromEnv,
  type PriceBreakdown,
  type PricingRules,
} from "@repo/pricing-engine";

type EventLike = Record<string, unknown> & {
  date?: Date | string;
  total_tickets?: number;
  totalTickets?: number;
  booked_tickets?: number;
  bookedTickets?: number;
  base_price?: number | string;
  basePrice?: number;
  floor_price?: number | string;
  floorPrice?: number;
  ceiling_price?: number | string;
  ceilingPrice?: number;
  pricing_rules?: PricingRules;
  pricingRules?: PricingRules;
};

export function calculateEventPrice(
  event: EventLike,
  recentBookingsCount: number,
): PriceBreakdown {
  return calculatePrice({
    basePrice: toNumber(event.base_price ?? event.basePrice),
    floorPrice: toNumber(event.floor_price ?? event.floorPrice),
    ceilingPrice: toNumber(event.ceiling_price ?? event.ceilingPrice),
    eventDate: new Date(String(event.date)),
    totalTickets: Number(event.total_tickets ?? event.totalTickets),
    bookedTickets: Number(event.booked_tickets ?? event.bookedTickets),
    recentBookingsCount,
    weights: weightsFromEnv(process.env),
    rules: (event.pricing_rules ?? event.pricingRules ?? {}) as PricingRules,
  });
}

export function toNumber(value: unknown): number {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string") {
    return Number(value);
  }

  return 0;
}

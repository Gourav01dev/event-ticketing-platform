import { describe, expect, it } from "vitest";
import {
  calculateDemandAdjustment,
  calculateInventoryAdjustment,
  calculatePrice,
  calculateTimeAdjustment,
} from "../src";

const now = new Date("2026-01-01T12:00:00.000Z");

describe("pricing engine", () => {
  it("keeps base price for events more than 7 days out", () => {
    const result = calculateTimeAdjustment(
      new Date("2026-02-01T12:00:00.000Z"),
      now,
    );

    expect(result.adjustment).toBe(0);
  });

  it("adds 20% for events within 7 days", () => {
    const result = calculateTimeAdjustment(
      new Date("2026-01-05T12:00:00.000Z"),
      now,
    );

    expect(result.adjustment).toBe(0.2);
  });

  it("adds 50% for events within 1 day", () => {
    const result = calculateTimeAdjustment(
      new Date("2026-01-02T00:00:00.000Z"),
      now,
    );

    expect(result.adjustment).toBe(0.5);
  });

  it("adds demand adjustment after more than 10 recent bookings", () => {
    expect(calculateDemandAdjustment(11).adjustment).toBe(0.15);
    expect(calculateDemandAdjustment(10).adjustment).toBe(0);
  });

  it("adds inventory adjustment below 20% remaining", () => {
    expect(calculateInventoryAdjustment(100, 81).adjustment).toBe(0.25);
    expect(calculateInventoryAdjustment(100, 80).adjustment).toBe(0);
  });

  it("combines weighted adjustments deterministically", () => {
    const result = calculatePrice({
      basePrice: 100,
      floorPrice: 50,
      ceilingPrice: 250,
      eventDate: new Date("2026-01-02T00:00:00.000Z"),
      totalTickets: 100,
      bookedTickets: 90,
      recentBookingsCount: 12,
      now,
      weights: { time: 1, demand: 0.5, inventory: 1 },
    });

    expect(result.finalPrice).toBe(182.5);
    expect(result.adjustments).toHaveLength(3);
  });

  it("respects floor and ceiling constraints", () => {
    const capped = calculatePrice({
      basePrice: 100,
      floorPrice: 80,
      ceilingPrice: 120,
      eventDate: new Date("2026-01-02T00:00:00.000Z"),
      totalTickets: 100,
      bookedTickets: 90,
      recentBookingsCount: 12,
      now,
    });

    const floored = calculatePrice({
      basePrice: 40,
      floorPrice: 75,
      ceilingPrice: 120,
      eventDate: new Date("2026-02-02T00:00:00.000Z"),
      totalTickets: 100,
      bookedTickets: 0,
      recentBookingsCount: 0,
      now,
    });

    expect(capped.finalPrice).toBe(120);
    expect(floored.finalPrice).toBe(75);
  });
});

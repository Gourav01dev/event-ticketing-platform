"use client";

import { useEffect, useState } from "react";
import { formatMoney, type PriceBreakdown } from "../lib/api";

export function LivePrice({
  eventId,
  initialBreakdown,
}: {
  eventId: string;
  initialBreakdown: PriceBreakdown;
}) {
  const [breakdown, setBreakdown] = useState(initialBreakdown);

  useEffect(() => {
    const interval = window.setInterval(async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001"}/events/${eventId}`,
        { cache: "no-store" },
      );
      if (response.ok) {
        const data = await response.json();
        setBreakdown(data.priceBreakdown);
      }
    }, 30000);

    return () => window.clearInterval(interval);
  }, [eventId]);

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-stone-500">Current price</p>
          <p className="text-3xl font-semibold text-stone-950">
            {formatMoney(breakdown.finalPrice)}
          </p>
        </div>
        <p className="text-sm text-stone-500">
          Base {formatMoney(breakdown.basePrice)}
        </p>
      </div>
      <div className="mt-5 space-y-3">
        {breakdown.adjustments.map((adjustment) => (
          <div
            className="flex items-center justify-between border-t border-stone-100 pt-3 text-sm"
            key={adjustment.rule}
          >
            <div>
              <p className="font-medium capitalize text-stone-800">
                {adjustment.rule}
              </p>
              <p className="text-stone-500">{adjustment.label}</p>
            </div>
            <span className="font-medium text-teal-700">
              +{Math.round(adjustment.weightedAdjustment * 100)}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import { useActionState } from "react";
import { createBookingAction } from "../actions/book";

export function BookingForm({
  eventId,
  remainingTickets,
}: {
  eventId: string;
  remainingTickets: number;
}) {
  const [state, formAction, isPending] = useActionState(createBookingAction, {});
  const isSoldOut = remainingTickets <= 0;

  return (
    <form
      action={formAction}
      className="space-y-4 rounded-lg border border-stone-200 bg-white p-5 shadow-sm"
    >
      <div>
        <h2 className="text-lg font-semibold text-stone-950">Reserve tickets</h2>
        <p className="mt-1 text-sm text-stone-500">
          Your price is captured when the booking succeeds.
        </p>
      </div>
      <input name="eventId" type="hidden" value={eventId} />
      {isSoldOut ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          Not enough tickets available. 0 remaining.
        </div>
      ) : null}
      {state.error ? (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
          {state.error}
        </div>
      ) : null}
      <div>
        <label className="text-sm font-medium text-stone-700" htmlFor="userEmail">
          Email
        </label>
        <input
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none focus:border-teal-600"
          id="userEmail"
          name="userEmail"
          placeholder="you@example.com"
          required
          disabled={isSoldOut || isPending}
          type="email"
        />
      </div>
      <div>
        <label className="text-sm font-medium text-stone-700" htmlFor="quantity">
          Tickets
        </label>
        <input
          className="mt-1 w-full rounded-md border border-stone-300 px-3 py-2 text-stone-950 outline-none focus:border-teal-600"
          defaultValue={1}
          id="quantity"
          max={Math.max(remainingTickets, 1)}
          min={1}
          name="quantity"
          required
          disabled={isSoldOut || isPending}
          type="number"
        />
      </div>
      <button
        className="w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:bg-stone-300"
        disabled={isSoldOut || isPending}
      >
        {isSoldOut ? "Sold out" : isPending ? "Booking..." : "Book tickets"}
      </button>
    </form>
  );
}

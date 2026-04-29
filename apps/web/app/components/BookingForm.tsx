import { createBookingAction } from "../actions/book";

export function BookingForm({ eventId }: { eventId: string }) {
  return (
    <form
      action={createBookingAction}
      className="space-y-4 rounded-lg border border-stone-200 bg-white p-5"
    >
      <input name="eventId" type="hidden" value={eventId} />
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
          min={1}
          name="quantity"
          required
          type="number"
        />
      </div>
      <button className="w-full rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
        Book tickets
      </button>
    </form>
  );
}

import { Header } from "../components/Header";
import { apiFetch, formatDate, formatMoney, type Booking } from "../lib/api";

export default async function MyBookingsPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;
  const data = email
    ? await apiFetch<{ bookings: Booking[] }>(
        `/bookings?userEmail=${encodeURIComponent(email)}`,
      )
    : { bookings: [] };

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-3xl font-semibold text-stone-950">My bookings</h1>
        <form className="mt-6 flex gap-3">
          <input
            className="min-w-0 flex-1 rounded-md border border-stone-300 px-3 py-2 outline-none focus:border-teal-600"
            defaultValue={email}
            name="email"
            placeholder="you@example.com"
            type="email"
          />
          <button className="rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800">
            Search
          </button>
        </form>
        <div className="mt-6 space-y-3">
          {data.bookings.map((booking) => (
            <article
              className="rounded-lg border border-stone-200 bg-white p-5"
              key={booking.id}
            >
              <div className="flex flex-col justify-between gap-3 sm:flex-row">
                <div>
                  <h2 className="font-semibold text-stone-950">
                    {booking.eventName}
                  </h2>
                  <p className="text-sm text-stone-500">
                    {formatDate(booking.createdAt)}
                  </p>
                </div>
                <div className="text-sm text-stone-700 sm:text-right">
                  <p>{booking.quantity} tickets</p>
                  <p>
                    Paid {formatMoney(booking.pricePaid)} · Current{" "}
                    {formatMoney(booking.currentPrice ?? booking.pricePaid)}
                  </p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </main>
    </div>
  );
}

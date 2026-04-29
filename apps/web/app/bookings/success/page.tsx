import Link from "next/link";
import { Header } from "../../components/Header";
import { apiFetch, formatMoney, type Booking } from "../../lib/api";

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ id?: string; eventId?: string }>;
}) {
  const { id, eventId } = await searchParams;
  const data = eventId
    ? await apiFetch<{ bookings: Booking[] }>(`/bookings?eventId=${eventId}`)
    : { bookings: [] };
  const booking = data.bookings.find((item) => item.id === id);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="mx-auto max-w-2xl px-4 py-10">
        <section className="rounded-lg border border-stone-200 bg-white p-6">
          <p className="text-sm font-medium text-teal-700">Booking confirmed</p>
          <h1 className="mt-2 text-3xl font-semibold text-stone-950">
            Your tickets are reserved
          </h1>
          {booking ? (
            <div className="mt-6 space-y-3 text-stone-700">
              <Row label="Event" value={booking.eventName ?? booking.eventId} />
              <Row label="Tickets" value={String(booking.quantity)} />
              <Row label="Price paid" value={formatMoney(booking.pricePaid)} />
              <Row
                label="Current price"
                value={formatMoney(booking.currentPrice ?? booking.pricePaid)}
              />
            </div>
          ) : (
            <p className="mt-6 text-stone-600">Booking details are loading.</p>
          )}
          <Link
            className="mt-6 inline-flex rounded-md bg-teal-700 px-4 py-2 font-medium text-white hover:bg-teal-800"
            href="/events"
          >
            Browse events
          </Link>
        </section>
      </main>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-stone-100 pt-3">
      <span className="text-stone-500">{label}</span>
      <span className="font-medium text-stone-950">{value}</span>
    </div>
  );
}

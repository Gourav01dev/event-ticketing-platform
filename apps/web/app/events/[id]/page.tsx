import { BookingForm } from "../../components/BookingForm";
import { Header } from "../../components/Header";
import { LivePrice } from "../../components/LivePrice";
import {
  apiFetch,
  formatDate,
  type EventSummary,
  type PriceBreakdown,
} from "../../lib/api";

export default async function EventDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const data = await apiFetch<{
    event: EventSummary;
    priceBreakdown: PriceBreakdown;
  }>(`/events/${id}`);

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="mx-auto grid max-w-6xl gap-6 px-4 py-8 lg:grid-cols-[1fr_360px]">
        <section>
          <p className="text-sm font-medium text-teal-700">
            {formatDate(data.event.date)}
          </p>
          <h1 className="mt-2 text-4xl font-semibold text-stone-950">
            {data.event.name}
          </h1>
          <p className="mt-2 text-lg text-stone-600">{data.event.venue}</p>
          <p className="mt-6 max-w-3xl text-stone-700">
            {data.event.description}
          </p>
          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Metric label="Total tickets" value={data.event.totalTickets} />
            <Metric label="Booked" value={data.event.bookedTickets} />
            <Metric label="Remaining" value={data.event.remainingTickets} />
          </div>
        </section>
        <aside className="space-y-4">
          <LivePrice
            eventId={data.event.id}
            initialBreakdown={data.priceBreakdown}
          />
          <BookingForm eventId={data.event.id} />
        </aside>
      </main>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4">
      <p className="text-sm text-stone-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-stone-950">{value}</p>
    </div>
  );
}

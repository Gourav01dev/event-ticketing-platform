import Link from "next/link";
import { Header } from "../components/Header";
import { apiFetch, formatDate, formatMoney, type EventSummary } from "../lib/api";

export default async function EventsPage() {
  const data = await apiFetch<{ events: EventSummary[] }>("/events");

  return (
    <div className="min-h-screen bg-stone-50">
      <Header />
      <main className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <h1 className="text-3xl font-semibold text-stone-950">Events</h1>
            <p className="mt-2 text-stone-600">
              Live availability and dynamic prices for upcoming events.
            </p>
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          {data.events.map((event) => (
            <Link
              className="rounded-lg border border-stone-200 bg-white p-5 transition hover:border-teal-600"
              href={`/events/${event.id}`}
              key={event.id}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-semibold text-stone-950">
                    {event.name}
                  </h2>
                  <p className="mt-1 text-sm text-stone-600">{event.venue}</p>
                </div>
                <p className="text-lg font-semibold text-teal-700">
                  {formatMoney(event.currentPrice)}
                </p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 text-sm text-stone-600">
                <span>{formatDate(event.date)}</span>
                <span>{event.remainingTickets} tickets left</span>
              </div>
            </Link>
          ))}
        </div>
      </main>
    </div>
  );
}

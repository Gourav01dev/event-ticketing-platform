import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-stone-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link className="text-lg font-semibold text-stone-950" href="/events">
          Dynamic Tickets
        </Link>
        <nav className="flex items-center gap-4 text-sm text-stone-600">
          <Link className="hover:text-stone-950" href="/events">
            Events
          </Link>
          <Link className="hover:text-stone-950" href="/my-bookings">
            My bookings
          </Link>
        </nav>
      </div>
    </header>
  );
}

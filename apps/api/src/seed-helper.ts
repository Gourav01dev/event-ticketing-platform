import { sql } from "@repo/database";

const daysFromNow = (days: number) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

export async function seedDatabase() {
  await sql`delete from bookings`;
  await sql`delete from events`;

  await sql`
    insert into events (
      name, date, venue, description, total_tickets, booked_tickets,
      base_price, current_price, floor_price, ceiling_price, pricing_rules
    )
    values
      (
        'NextWave Summit', ${daysFromNow(35)}::timestamptz, 'Bangalore International Centre',
        'A focused conference for product teams, founders, and engineers building modern platforms.',
        300, 42, 1499, 1499, 999, 3499, '{}'
      ),
      (
        'Indie Music Night', ${daysFromNow(6)}::timestamptz, 'The Humming Tree',
        'An intimate live show featuring independent artists and limited floor capacity.',
        120, 88, 799, 959, 599, 1799, '{}'
      ),
      (
        'Last Call Comedy', ${daysFromNow(1)}::timestamptz, 'Phoenix Arena',
        'A late evening comedy lineup with dynamic demand-based ticket pricing.',
        80, 68, 999, 1499, 699, 2499, '{}'
      )
  `;
}

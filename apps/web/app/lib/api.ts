export type EventSummary = {
  id: string;
  name: string;
  date: string;
  venue: string;
  description: string;
  totalTickets: number;
  bookedTickets: number;
  remainingTickets: number;
  basePrice: number;
  currentPrice: number;
  floorPrice: number;
  ceilingPrice: number;
};

export type PriceBreakdown = {
  basePrice: number;
  floorPrice: number;
  ceilingPrice: number;
  finalPrice: number;
  unclampedPrice: number;
  totalWeightedAdjustment: number;
  adjustments: {
    rule: string;
    label: string;
    rawAdjustment: number;
    weight: number;
    weightedAdjustment: number;
  }[];
};

export type Booking = {
  id: string;
  eventId: string;
  eventName?: string;
  userEmail: string;
  quantity: number;
  pricePaid: number;
  currentPrice?: number;
  createdAt: string;
};

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      "content-type": "application/json",
      ...init?.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error ?? "Request failed");
  }

  return data as T;
}

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);

export const formatDate = (value: string) =>
  new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));

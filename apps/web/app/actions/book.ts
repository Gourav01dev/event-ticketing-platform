"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

export async function createBookingAction(formData: FormData) {
  const eventId = String(formData.get("eventId"));
  const userEmail = String(formData.get("userEmail"));
  const quantity = Number(formData.get("quantity"));

  const data = await apiFetch<{ booking: { id: string } }>("/bookings", {
    method: "POST",
    body: JSON.stringify({ eventId, userEmail, quantity }),
  });

  redirect(`/bookings/success?id=${data.booking.id}&eventId=${eventId}`);
}

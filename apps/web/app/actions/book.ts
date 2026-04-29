"use server";

import { redirect } from "next/navigation";
import { apiFetch } from "../lib/api";

export type BookingActionState = {
  error?: string;
};

export async function createBookingAction(
  _state: BookingActionState,
  formData: FormData,
): Promise<BookingActionState> {
  const eventId = String(formData.get("eventId"));
  const userEmail = String(formData.get("userEmail"));
  const quantity = Number(formData.get("quantity"));

  let bookingId: string;

  try {
    const data = await apiFetch<{ booking: { id: string } }>("/bookings", {
      method: "POST",
      body: JSON.stringify({ eventId, userEmail, quantity }),
    });
    bookingId = data.booking.id;
  } catch (error) {
    return {
      error:
        error instanceof Error
          ? error.message
          : "Unable to complete booking. Please try again.",
    };
  }

  redirect(`/bookings/success?id=${bookingId}&eventId=${eventId}`);
}

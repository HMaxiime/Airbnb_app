import { z } from "zod";

// Booking creation rules: ids must be valid integers, dates must be valid ISO strings, and check-in must be before check-out.
export const createBookingSchema = z.object({
  listingId: z.number().int().positive("Listing ID must be a positive integer"),
  guestId: z.number().int().positive("Guest ID must be a positive integer").optional(),
  totalPrice: z.number().positive("Total price must be positive"),
  checkIn: z.string().datetime("Invalid checkIn date"),
  checkOut: z.string().datetime("Invalid checkOut date"),
}).refine(
  (data) => new Date(data.checkIn) < new Date(data.checkOut),
  { message: "checkIn must be before checkOut", path: ["checkIn"] }
).refine(
  (data) => new Date(data.checkIn) > new Date(),
  { message: "checkIn must be in the future", path: ["checkIn"] }
);

export const updateBookingSchema = createBookingSchema.partial();
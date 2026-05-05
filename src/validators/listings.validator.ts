import { z } from "zod";

// Listing schemas keep the create payload strict and let updates reuse the same fields as optional.
export const createListingSchema = z.object({
  title: z.string().min(5, "Title must be at least 5 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  location: z.string().min(2, "Location is required"),
  price: z.number().positive("Price must be a positive number"),
  type: z.enum(["APARTMENT", "HOUSE", "ROOM", "OTHER"]).optional(),
});

export const updateListingSchema = createListingSchema.partial();
// .partial() makes all fields optional — perfect for PUT/PATCH
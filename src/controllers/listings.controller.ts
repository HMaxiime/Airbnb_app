import type { Request, Response, NextFunction } from "express";
import { listings, type Listing } from "../models/listing.model.js";

// Return the whole in-memory listing collection.
export function getAllListings(req: Request, res: Response) {
  res.json(listings);
}

// Find one listing by id and return 404 if nothing matches.
export function getListingById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  const id = parseInt(req.params["id"] as string);
  const listing = listings.find((l) => l.id === id);

  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  res.json(listing);
}

// Create a listing after checking the request body contains the required fields.
export function createListing(req: Request, res: Response, next: NextFunction) {
  const {
    title,
    description,
    location,
    pricePerNight,
    guests,
    type,
    amenities,
    host,
  } = req.body as Listing;

  if (
    !title ||
    !description ||
    !location ||
    !pricePerNight ||
    !guests ||
    !type ||
    !amenities ||
    !host
  ) {
    return res.status(400).json({
      error:
        "title, description, location, pricePerNight, guests, type, amenities, and host are required",
    });
  }

  const newListing: Listing = {
    id: listings.length > 0 ? listings[listings.length - 1]!.id + 1 : 1,
    title,
    description,
    location, pricePerNight,
    guests,
    type,
    amenities,
    host,
    rating: req.body.rating, // optional — fine if undefined
  };

  listings.push(newListing);
  res.status(201).json(newListing);
}

// Update an existing listing by merging the incoming fields into the stored object.
export function updateListing(req: Request, res: Response, next: NextFunction) {
  const id = parseInt(req.params["id"] as string);
  const index = listings.findIndex((l) => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Listing not found" });
  }

  listings[index] = { ...listings[index], ...req.body } as Listing;
  res.json(listings[index]);
}

// Remove a listing from the in-memory array.
export function deleteListing(req: Request, res: Response, next: NextFunction) {
  const id = parseInt(req.params["id"] as string);
  const index = listings.findIndex((l) => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Listing not found" });
  }

  listings.splice(index, 1);
  res.json({ message: "Listing deleted successfully" });
}     

// Report a simple status payload for a single listing.
export function listingstatus(req: Request, res: Response, next: NextFunction) {
  const id = parseInt(req.params["id"] as string);
  const index = listings.findIndex((l) => l.id === id);

  if (index === -1) {
    return res.status(404).json({ error: "Listing not found" });
  }

  res.json({ id, status: "active", listing: listings[index] });
}
import type { Request, Response, NextFunction } from "express";
import prisma from "../config/prisma.js";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import { createListingSchema, updateListingSchema } from "../validators/listings.validator.js";

// Return all listings from the database with pagination.
export async function getAllListings(req: Request, res: Response, next: NextFunction) {
  try {
    const page = parseInt(req.query["page"] as string) || 1;
    const limit = parseInt(req.query["limit"] as string) || 20;
    const skip = (page - 1) * limit;

    const [listings, total] = await Promise.all([
      prisma.listing.findMany({
        skip,
        take: limit,
        include: { host: { select: { id: true, name: true, email: true } } },
      }),
      prisma.listing.count(),
    ]);

    res.json({
      data: listings,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
}

// Find one listing by id and return 404 if nothing matches.
export async function getListingById(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params["id"] as string);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { host: { select: { id: true, name: true, email: true } } },
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    res.json(listing);
  } catch (error) {
    next(error);
  }
}

// Create a listing after validating input and checking host exists.
export async function createListing(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const data = createListingSchema.parse(req.body);

    if (!req.userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    // Verify the host (authenticated user) exists
    const host = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!host) {
      return res.status(404).json({ error: "User not found" });
    }

    const newListing = await prisma.listing.create({
      data: {
        title: data.title,
        description: data.description,
        location: data.location,
        price: data.price,
        hostId: req.userId,
      },
      include: { host: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(newListing);
  } catch (error) {
    next(error);
  }
}

// Update an existing listing by id.
export async function updateListing(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params["id"] as string);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const data = updateListingSchema.parse(req.body);

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Only the host can update their listing
    if (listing.hostId !== req.userId) {
      return res.status(403).json({ error: "Forbidden: you can only update your own listings" });
    }

    // Filter out undefined values
    const updateData = Object.fromEntries(
      Object.entries(data).filter(([, value]) => value !== undefined)
    );

    const updatedListing = await prisma.listing.update({
      where: { id },
      data: updateData,
      include: { host: { select: { id: true, name: true, email: true } } },
    });

    res.json(updatedListing);
  } catch (error) {
    next(error);
  }
}

// Remove a listing from the database.
export async function deleteListing(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params["id"] as string);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const listing = await prisma.listing.findUnique({ where: { id } });
    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    // Only the host can delete their listing
    if (listing.hostId !== req.userId) {
      return res.status(403).json({ error: "Forbidden: you can only delete your own listings" });
    }

    await prisma.listing.delete({ where: { id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

// Report a simple status payload for a single listing.
export async function listingstatus(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const id = parseInt(req.params["id"] as string);

    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid listing ID" });
    }

    const listing = await prisma.listing.findUnique({
      where: { id },
      include: { host: { select: { id: true, name: true } } },
    });

    if (!listing) {
      return res.status(404).json({ error: "Listing not found" });
    }

    res.json({ id, status: "active", listing });
  } catch (error) {
    next(error);
  }
}
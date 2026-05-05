import prisma from "../config/prisma.js";
import type { Request, Response, NextFunction } from "express";
import type { AuthRequest } from "../middlewares/auth.middleware.js";

// Return every booking currently stored in the database.
export const getAllBookings = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const bookings = await prisma.booking.findMany();
    res.status(200).json(bookings);
  } catch (error) {
    next(error);
  }
};

// GET /bookings/:id — return a single booking, or 404
// Fetch one booking by id and return 404 if nothing matches.
export const getBookingById = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params["id"] as string;
  try {
    const booking = await prisma.booking.findUnique({ where: { id } });

    if (!booking) {
      return res.status(404).json({ Message: "Booking not found" });
    }
    res.status(200).json(booking);
  } catch (error) {
    next(error);
  }
};

// Hosts use this flow to approve or reject a booking.
export const changeBookingStatus = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const id = req.params["id"] as string;
    const rawStatus = req.body?.status as string | undefined;

    if (!rawStatus) {
      return res.status(400).json({ Message: "Status is required" });
    }

    const normalizedStatus = rawStatus.toUpperCase();
    if (!["PENDING", "CONFIRMED", "CANCELLED"].includes(normalizedStatus)) {
      return res.status(400).json({ Message: "Invalid status value" });
    }

    const existingBooking = await prisma.booking.findUnique({ where: { id } });
    if (!existingBooking) {
      return res.status(404).json({ Message: "Booking not found" });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: { status: normalizedStatus as "PENDING" | "CONFIRMED" | "CANCELLED" },
    });

    res
      .status(200)
      .json({ message: "Booking status updated successfully", updatedBooking });
  } catch (error) {
    next(error);
  }
};

// POST /bookings — create a new booking, or 400 if fields are missing
// Create a booking after validating dates, ids, and overlap rules.
export const createBooking = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const { checkIn, checkOut, totalPrice, listingId } = req.body;
  const guestIdFromToken = req.userId;

  if (!checkIn || !checkOut || !listingId || totalPrice === undefined || totalPrice === null) {
    return res
      .status(400)
      .json({ Message: "checkIn, checkOut, listingId, and totalPrice are required" });
  }

  if (!guestIdFromToken) {
    return res.status(401).json({ Message: "Unauthorized" });
  }

  try {
    const parsedCheckIn = new Date(checkIn);
    const parsedCheckOut = new Date(checkOut);
      const parsedListingId = String(listingId);
    const parsedTotalPrice = Number(totalPrice);

    if (isNaN(parsedCheckIn.getTime()) || isNaN(parsedCheckOut.getTime())) {
      return res.status(400).json({ Message: "Invalid date format for checkIn or checkOut" });
    }

      if (!parsedListingId || typeof parsedListingId !== "string") {
      return res.status(400).json({ Message: "Invalid numeric values" });
    }

    const booking = await prisma.$transaction(async (tx) => {
      // Check for conflicts inside the transaction
      const conflict = await tx.booking.findFirst({
        where: {
            listingId: parsedListingId,
          status: "CONFIRMED",
          checkIn: { lt: parsedCheckOut },
          checkOut: { gt: parsedCheckIn },
        },
      });

      if (conflict) {
        throw new Error("Listing already booked for these dates");
        // throwing inside $transaction automatically rolls back everything
      }

      // Safe to create — no conflict found
      return tx.booking.create({
        data: {
          listingId: parsedListingId,
          guestId: guestIdFromToken,
          UserId: guestIdFromToken,
          checkIn: parsedCheckIn,
          checkOut: parsedCheckOut,
          totalPrice: parsedTotalPrice,
          status: "PENDING",
        },
      });
    });

    res.status(201).json(booking);
  } catch (error) {
    next(error);
  }
};

//DELETE booking
// Delete a booking by id.
export const deleteBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params["id"] as string;
  try {
    const deletedBooking = await prisma.booking.delete({ where: { id } });

    res.status(200).json({ message: "Booking deleted successfully" });
  } catch (error) {
    next(error);
  }
};

//PUT update booking
// Update a booking using the fields provided in the request body.
export const updateBooking = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  const id = req.params["id"] as string;
  const { checkIn, checkOut, totalPrice, listingId, status } = req.body;
  try {
    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        checkIn,
        checkOut,
        totalPrice,
        listingId,
        status,
      },
    });
    res
      .status(200)
      .json({ message: "updated booking successfully", updatedBooking });
  } catch (error) {
    next(error);
  }
};

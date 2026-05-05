import type { Request, Response ,NextFunction } from "express";
import type { Prisma } from "@prisma/client";
import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import {createUserSchema, updateUserSchema } from "../validators/users.validators.js";  

// Convert the route parameter into a number before handing it to Prisma.
function parseUserId(idParam: string): number | null {
  const id = Number.parseInt(idParam, 10);
  return Number.isNaN(id) ? null : id;
}

// List users with simple pagination so large tables stay readable.
export async function getAllUsers(req: Request, res: Response) {
  const page = parseInt(req.query["page"] as string) || 1;
  const limit = parseInt(req.query["limit"] as string) || 20;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({ skip, take: limit }),
    prisma.user.count(),
  ]);

  res.json({
    data: users,
    meta: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  });
}

// GET /users/:id — return a single user, or 404
// Fetch one user by id and return a friendly 404 when the record is missing.
export async function getUserById(req: Request, res: Response) {
  const id = parseUserId(req.params["id"] as string);

  if (id === null) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const user = await prisma.user.findUnique({ where: { id } });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    console.error("Error fetching user by id:", error);
    res
      .status(500)
      .json({ error: "An error occurred while fetching the user" });
  }
}

// POST /users — create a new user, or 400 if fields are missing
// Create a new user by validating input, hashing the password, and hiding the hash in the response.
export async function createUser(req: Request, res: Response) {
  
  try {
    const data = createUserSchema.parse(req.body);
    const hashedPassword = await bcrypt.hash(data.password, 10);

    const newUser = await prisma.user.create({
      data: {
        ...data,
        password: hashedPassword,
      }
    });
    const { password: _, ...userWithoutPassword } = newUser;
    res.status(201).json(userWithoutPassword);
  } catch (error) {
    console.error("Error creating user:", error);
    res.status(500).json({ error: "An error occurred while creating the user" });
  }
}
// PUT /users/:id — update an existing user, or 404 if not found
// Update a user after parsing the id and removing undefined fields from the payload.
export async function updateUser(req: Request, res: Response, next: NextFunction) {
  // Convert the URL param "id" from string to numb

  try {
    const id = parseUserId(req.params["id"] as string);

    if (id === null) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const parsedData = updateUserSchema.parse(req.body);
    const data: Prisma.UserUpdateInput = Object.fromEntries(
      Object.entries(parsedData).filter(([, value]) => value !== undefined)
    ) as Prisma.UserUpdateInput;

    const existingUser = await prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }
    const updatedUser = await prisma.user.update({
      where: { id },
      data
    });
    res.json(updatedUser);
  } catch (error) {
    next(error);
  }
}

// DELETE /users/:id — remove a user, or 404 if not found
// Delete a user only after confirming the record exists.
export async function deleteUser(req: Request, res: Response) {
  const id = parseUserId(req.params["id"] as string);

  if (id === null) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const existingUser = await prisma.user.findUnique({ where: { id } });

    if (!existingUser) {
      return res.status(404).json({ error: "User not found" });
    }

    await prisma.user.delete({ where: { id } });
    res.status(204).send(); // 204 No Content
  } catch (error) {
    console.error("Error deleting user:", error);
    res
      .status(500)
      .json({ error: "An error occurred while deleting the user" });
  }
}

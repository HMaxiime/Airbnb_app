import type { Request, Response, NextFunction } from "express";
import bcrypt from "bcrypt";
import prisma from "../config/prisma.js";
import jwt from "jsonwebtoken";
import type { AuthRequest } from "../middlewares/auth.middleware.js";
import crypto from "crypto";
import { sendEmail } from "../config/email.js";

// Registration flow: validate input, hash the password, create the user, and send a welcome email.
export async function register(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    const { name, email, username, password, phone, role } = req.body;

    if (!name || !email || !username || !password || !phone) {
      return res.status(400).json({ error: "All fields are required" });
    }

    if (password.length < 8) {
      return res.status(400).json({ message : "Password must be at least 8 characters" });
    }

    const existing = await prisma.user.findFirst({
      where: { OR: [{ email }, { username }] },
    });
    if (existing) {
      return res
        .status(409)
        .json({ message: "Email or username already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        username,
        phone,
        password: hashedPassword,
        role: role ?? "GUEST",
      },
    });

    const { password: _, ...userWithoutPassword } = user;
    res.status(201).json(userWithoutPassword);

    // inside register():
    await sendEmail(
      email,
      "Welcome to Airbnb!",
      `<h1>Welcome, ${name}!</h1><p>Your account has been created successfully.</p>`,
    );
  } catch (error) {
    next(error);
  }
}

// Login flow: verify credentials and issue a signed JWT for protected routes.
export async function login(req: Request, res: Response, next: NextFunction) {
  const { email, password } = req.body;
  try {
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      process.env.JWT_SECRET!,
      { expiresIn: "1h" },
    );

    const { password: _, ...userWithoutPassword } = user;

    res
      .status(200)
      .json({ message: "Login successful", token, user: userWithoutPassword });
  } catch (error) {
    next(error);
  }
}

// Return the authenticated user's profile using the userId attached by the auth middleware.
export async function getMe(req: Request, res: Response, next: NextFunction) {
  try {
    const userId = (req as any).userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        username: true,
        phone: true,
        role: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.status(200).json(user);
  } catch (error) {
    next(error);
  }
}

// Change-password flow: confirm the current password, then store a new hash.
export async function changePassword(req: AuthRequest, res: Response) {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res
      .status(400)
      .json({ error: "currentPassword and newPassword are required" });
  }

  if (newPassword.length < 8) {
    return res
      .status(400)
      .json({ error: "New password must be at least 8 characters" });
  }

  if (!req.userId) return res.status(401).json({ error: "Unauthorized" });

  const user = await prisma.user.findUnique({ where: { id: req.userId } });
  if (!user) return res.status(404).json({ error: "User not found" });

  const isMatch = await bcrypt.compare(currentPassword, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: "Current password is incorrect" });
  }

  const hashedPassword = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({
    where: { id: req.userId },
    data: { password: hashedPassword },
  });

  res.json({ message: "Password changed successfully" });
}

// Forgot-password flow: create a temporary reset token without revealing whether the email exists.
export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body;

  // Always return the same response — don't reveal if the email is registered
  const successResponse = {
    message: "If that email is registered, a reset link has been sent",
  };

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return res.json(successResponse);

  // Generate a raw random token — this goes in the email link
  const rawToken = crypto.randomBytes(32).toString("hex");

  // Hash before storing — if DB is compromised, raw tokens are not exposed
  const hashedToken = crypto
    .createHash("sha256")
    .update(rawToken)
    .digest("hex");

  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetToken: hashedToken,
      resetTokenExpiry: new Date(Date.now() + 60 * 60 * 1000 * 24 * 7), // 1 hour
    },
  });

  // In a real app: send email with link containing rawToken
  // e.g. http://localhost:3000/auth/reset-password/<rawToken>
  console.log(`Reset token for ${email}: ${rawToken}`);

  res.json({successResponse , rawToken});
}

// Reset-password flow: verify the token, replace the password, and clear the reset state.
export async function resetPassword(req: Request, res: Response) {
  const { token } = req.params;
  const { password } = req.body;

  if (!password || password.length < 8) {
    return res
      .status(400)
      .json({ error: "Password must be at least 8 characters" });
  }

  if (typeof token !== "string") {
    return res.status(400).json({ error: "Invalid reset token" });
  }

  // Hash the raw token from the URL to compare against the stored hash
  const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

  const user = await prisma.user.findFirst({
    where: {
      resetToken: hashedToken,
      resetTokenExpiry: { gt: new Date() }, // token must not be expired
    },
  });

  // Same error for both invalid token and expired token — don't reveal which
  if (!user) {
    return res.status(400).json({ error: "Invalid or expired reset token" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      password: hashedPassword,
      resetToken: null, // clear token after use — one-time use only
      resetTokenExpiry: null,
    },
  });

  res.json({ message: "Password reset successfully" });
}

import express from "express";
import bookingRouter from "./routes/booking.routes.js";
import listingsRouter from "./routes/listings.routes.js";
import usersRouter from "./routes/users.routes.js";
import { connectDB } from "./config/prisma.js";
import { errorHandler } from "./middlewares/errorHandler.js";
import { authenticate } from "./middlewares/auth.middleware.js";
import authRouter from "./routes/auth.routes.js";
import uploadRouter from "./routes/upload.routes.js";
import { setupSwagger } from "./config/swagger.js";
import compression from "compression";
import { generalLimiter } from "./middlewares/rateLimiter.js";

const app = express();
const PORT = 3000;

// Middleware order matters here: compression and rate limiting run before JSON parsing.
app.use(compression());
app.use(generalLimiter);
app.use(express.json());

// Swagger is mounted before the API routes so the docs are available as soon as the app starts.
setupSwagger(app); // Set up Swagger documentation

// Public auth routes stay open because users must be able to register and log in.
app.use("/auth", authRouter);

// Protected routes require authentication at the app level to prevent unauthorized access.
app.use("/users", authenticate, usersRouter);
app.use("/bookings", authenticate, bookingRouter); // Bookings require authentication
app.use("/listings", listingsRouter); // Listings can read publicly; write routes protected inside the router
app.use("/upload", authenticate, uploadRouter); // Upload routes require authentication at the top level

// Error handling must come last so it can catch failures from every route above.
app.use(errorHandler); // Global error handler for all routes

async function startServer() {
  try {
    // Connect to the database before opening the HTTP port.
    await connectDB();
    console.log("Database connection established successfully.");
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1); // Exit the process with an error code
  }
}

startServer();

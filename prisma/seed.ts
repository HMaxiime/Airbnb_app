import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({
  connectionString: process.env["DATABASE_URL"] as string,
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 Seeding database...");

  // Clear existing data in reverse order of dependencies
  await prisma.booking.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();
  console.log("🗑️  Cleared existing data");

  // ─── Seed Users ───────────────────────────────────────────────────────────
  const mike = await prisma.user.upsert({
    where: { email: "Mike@example.com" },
    update: {},
    create: {
      name: "Mike Johnson",
      email: "Mike@example.com",
      username: "mike_host",
      password: "hashedpassword",
      phone: "555-1234",
      role: "HOST",
    },
  });

  const alice = await prisma.user.upsert({
    where: { email: "alice@example.com" },
    update: {},
    create: {
      name: "Alice Smith",
      email: "alice@example.com",
      username: "alice_host",
      password: "hashedpassword",
      phone: "555-1234",
      role: "HOST",
    },
  });

  const bob = await prisma.user.upsert({
    where: { email: "bob@example.com" },
    update: {},
    create: {
      name: "Bob Smith",
      email: "bob@example.com",
      username: "bob_guest",
      password: "hashedpassword",
      phone: "555-5678",
      role: "GUEST",
    },
  });

  const carol = await prisma.user.upsert({
    where: { email: "carol@example.com" },
    update: {},
    create: {
      name: "Carol White",
      email: "carol@example.com",
      username: "carol_guest",
      password: "hashedpassword",
      phone: "555-9012",
      role: "GUEST",
    },
  });

  // ─── Seed Listings ────────────────────────────────────────────────────────
  await prisma.listing.createMany({
  data: [
    {
      title: "Cozy apartment in downtown",
      description: "A beautiful apartment in the heart of the city",
      location: "New York, NY",
      price: 120,
      guests: 2,
      type: "APARTMENT",
      amenities: ["WiFi", "Kitchen", "Air conditioning"],
      hostId: alice.id,
    },
    {
      title: "Beachside villa",
      description: "Luxury villa with ocean view",
      location: "Miami, FL",
      price: 300,
      guests: 4,
      type: "HOUSE",
      amenities: ["Pool", "WiFi", "Kitchen"],
      hostId: mike.id,
    },
  ],
  skipDuplicates: true,
});

console.log("📦 Bulk listings created");

// Individually create listings we need to reference for bookings
const listing1 = await prisma.listing.create({
  data: {
    title: "Modern loft in the city",
    description: "A stylish loft in the heart of the city",
    location: "Los Angeles, CA",
    price: 150,
    guests: 3,
    type: "APARTMENT",
    amenities: ["WiFi", "Gym", "Pool"],
    hostId: mike.id,
  },
});

const listing2 = await prisma.listing.create({
  data: {
    title: "Cozy house with garden",
    description: "Perfect for families and small groups",
    location: "San Francisco, CA",
    price: 200,
    guests: 4,
    type: "HOUSE",
    amenities: ["WiFi", "Garden", "Parking"],
    hostId: alice.id,
  },
});

console.log("🏠 Individual listings created:", listing1.id, listing2.id);
}

main()
  .then(() => {
    console.log("✅ Seed complete");
  })
  .catch((error) => {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding database...");

  // Example seed data - customize as needed
  const user = await prisma.user.upsert({
    where: { address: "0x0000000000000000000000000000000000000001" },
    update: {},
    create: {
      address: "0x0000000000000000000000000000000000000001",
      username: "testuser",
      displayName: "Test User",
    },
  });

  console.log("Created user:", user.id);
  console.log("Seeding complete!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

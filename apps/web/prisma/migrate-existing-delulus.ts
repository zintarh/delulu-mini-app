/**
 * Migration script to update existing Delulu records with default bgImageUrl
 * Run this after pushing the schema with bgImageUrl as optional
 */

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Starting migration: Adding bgImageUrl to existing Delulu records...");

  // Get base URL for default template
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const defaultImageUrl = `${baseUrl}/templates/t0.png`;

  // Find all delulus without bgImageUrl
  const delulusWithoutImage = await prisma.delulu.findMany({
    where: {
      bgImageUrl: null,
    },
  });

  console.log(`Found ${delulusWithoutImage.length} delulus without bgImageUrl`);

  // Update each delulu with default template
  for (const delulu of delulusWithoutImage) {
    await prisma.delulu.update({
      where: { id: delulu.id },
      data: { bgImageUrl: defaultImageUrl },
    });
    console.log(`Updated delulu ${delulu.id} with default bgImageUrl`);
  }

  console.log("Migration completed successfully!");
}

main()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

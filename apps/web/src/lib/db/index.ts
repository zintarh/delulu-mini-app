/**
 * Prisma Database Client
 *
 * IMPORTANT: Run `pnpm db:generate` before using this module.
 * This generates the Prisma client from your schema.
 *
 * Setup steps:
 * 1. Set DATABASE_URL in .env.local
 * 2. Run `pnpm db:generate` to generate the client
 * 3. Run `pnpm db:push` to sync schema with database
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  // eslint-disable-next-line
  prisma: any | undefined;
};

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}

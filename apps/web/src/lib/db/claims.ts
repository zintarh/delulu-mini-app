import { db } from "./index";
import { findOrCreateUser } from "./users";
import type { CreateClaimInput } from "@/lib/validations/claim";

export async function createClaim(input: CreateClaimInput) {
  // Find or create user if they don't exist
  const user = await findOrCreateUser({
    address: input.userAddress,
  });

  const isOnChainId = /^\d+$/.test(input.deluluId);

  let delulu;
  if (isOnChainId) {
    delulu = await db.delulu.findUnique({
      where: { onChainId: BigInt(input.deluluId) },
    });
  } else {
    delulu = await db.delulu.findUnique({
      where: { id: input.deluluId },
    });
  }

  if (!delulu) {
    throw new Error("Delulu not found");
  }

  const existingClaim = await db.claim.findUnique({
    where: { txHash: input.txHash },
  });

  if (existingClaim) {
    console.log(
      `[createClaim] Claim with txHash ${input.txHash} already exists, returning existing claim`
    );
    return existingClaim;
  }

  return db.claim.create({
    data: {
      userId: user.id,
      deluluId: delulu.id, // Always use the database ID (UUID)
      amount: input.amount,
      txHash: input.txHash,
    },
  });
}

export async function getClaimsByUser(address: string) {
  const user = await db.user.findUnique({
    where: { address: address.toLowerCase() },
  });

  if (!user) return [];

  return db.claim.findMany({
    where: { userId: user.id },
    include: {
      delulu: { select: { content: true, onChainId: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getTotalClaimedByUser(address: string) {
  const user = await db.user.findUnique({
    where: { address: address.toLowerCase() },
  });

  if (!user) return 0;

  const result = await db.claim.aggregate({
    where: { userId: user.id },
    _sum: { amount: true },
  });

  return result._sum.amount ?? 0;
}

export async function getUserClaimForDelulu(
  address: string,
  deluluId: string
) {
  const user = await db.user.findUnique({
    where: { address: address.toLowerCase() },
  });

  if (!user) return null;

  // Determine if deluluId is an onChainId (numeric) or database id (UUID)
  const isOnChainId = /^\d+$/.test(deluluId);
  
  let delulu;
  if (isOnChainId) {
    delulu = await db.delulu.findUnique({
      where: { onChainId: BigInt(deluluId) },
    });
  } else {
    delulu = await db.delulu.findUnique({
      where: { id: deluluId },
    });
  }

  if (!delulu) return null;

  const claim = await db.claim.findFirst({
    where: {
      userId: user.id,
      deluluId: delulu.id,
    },
    orderBy: { createdAt: "desc" },
  });

  return claim;
}

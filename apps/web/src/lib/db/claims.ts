import { db } from "./index";
import type { CreateClaimInput } from "@/lib/validations/claim";

export async function createClaim(input: CreateClaimInput) {
  const user = await db.user.findUnique({
    where: { address: input.userAddress.toLowerCase() },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return db.claim.create({
    data: {
      userId: user.id,
      deluluId: input.deluluId,
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

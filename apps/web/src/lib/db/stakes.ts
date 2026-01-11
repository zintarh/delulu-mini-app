import { Prisma } from "@prisma/client";
import { db } from "./index";
import type { CreateStakeInput } from "@/lib/validations/stake";

// Type for stake with included delulu
export type StakeWithDelulu = Prisma.StakeGetPayload<{
  include: { delulu: { select: { content: true; onChainId: true; stakingDeadline: true } } };
}>;

export async function createStake(input: CreateStakeInput) {
  const user = await db.user.findUnique({
    where: { address: input.userAddress.toLowerCase() },
  });

  if (!user) {
    throw new Error("User not found");
  }

  // Determine if deluluId is an onChainId (numeric) or database id (UUID)
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

  // Idempotency check: Check if stake with this txHash already exists
  const existingByTxHash = await db.stake.findUnique({
    where: { txHash: input.txHash },
  });

  if (existingByTxHash) {
    console.log(`[createStake] Stake with txHash ${input.txHash} already exists, returning existing stake`);
    return existingByTxHash;
  }

  // Idempotency check: Check if user already has a stake on this delulu for this side
  const existingStake = await db.stake.findUnique({
    where: {
      userId_deluluId_side: {
        userId: user.id,
        deluluId: delulu.id,
        side: input.side,
      },
    },
  });

  if (existingStake) {
    console.log(`[createStake] User already has a stake on delulu ${delulu.id} for side ${input.side}, returning existing stake`);
    return existingStake;
  }

  const stake = await db.stake.create({
    data: {
      userId: user.id,
      deluluId: delulu.id, // Always use the database ID
      amount: input.amount,
      side: input.side,
      txHash: input.txHash,
    },
  });

  // Update delulu stats
  const field = input.side ? "totalBelieverStake" : "totalDoubterStake";
  await db.delulu.update({
    where: { id: delulu.id },
    data: { [field]: { increment: input.amount } },
  });

  return stake;
}

export async function getStakesByUser(address: string): Promise<StakeWithDelulu[]> {
  const user = await db.user.findUnique({
    where: { address: address.toLowerCase() },
  });

  if (!user) return [];

  return db.stake.findMany({
    where: { userId: user.id },
    include: {
      delulu: { select: { content: true, onChainId: true, stakingDeadline: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}

export async function getStakesByDelulu(deluluId: string) {
  return db.stake.findMany({
    where: { deluluId },
    include: {
      user: { select: { address: true, username: true, pfpUrl: true } },
    },
  });
}

export async function getUserPosition(userAddress: string, deluluId: string) {
  const user = await db.user.findUnique({
    where: { address: userAddress.toLowerCase() },
  });

  if (!user) return null;

  const stakes = await db.stake.findMany({
    where: { userId: user.id, deluluId },
  });

  if (stakes.length === 0) return null;

  const believerStake = stakes
    .filter((s: (typeof stakes)[number]) => s.side)
    .reduce((acc: number, s: (typeof stakes)[number]) => acc + s.amount, 0);
  const doubterStake = stakes
    .filter((s: (typeof stakes)[number]) => !s.side)
    .reduce((acc: number, s: (typeof stakes)[number]) => acc + s.amount, 0);

  return { believerStake, doubterStake };
}

export async function getStakedDelulusByUser(address: string) {
  const user = await db.user.findUnique({
    where: { address: address.toLowerCase() },
  });

  if (!user) return [];

  const stakes = await db.stake.findMany({
    where: { userId: user.id },
    select: { deluluId: true, amount: true, side: true },
  });

  if (stakes.length === 0) return [];

  // Get unique delulu IDs
  const deluluIds = [...new Set(stakes.map((s: (typeof stakes)[number]) => s.deluluId))];

  // Fetch full delulu data
  const delulus = await db.delulu.findMany({
    where: { id: { in: deluluIds } },
    include: {
      creator: { select: { username: true, pfpUrl: true, address: true } },
    },
    orderBy: { stakingDeadline: "asc" },
  });

  // Aggregate user's position for each delulu
  return delulus.map((delulu: (typeof delulus)[number]) => {
    const userStakes = stakes.filter((s: (typeof stakes)[number]) => s.deluluId === delulu.id);
    const believerStake = userStakes
      .filter((s: (typeof userStakes)[number]) => s.side)
      .reduce((acc: number, s: (typeof userStakes)[number]) => acc + s.amount, 0);
    const doubterStake = userStakes
      .filter((s: (typeof userStakes)[number]) => !s.side)
      .reduce((acc: number, s: (typeof userStakes)[number]) => acc + s.amount, 0);

    return {
      ...delulu,
      userPosition: { believerStake, doubterStake },
    };
  });
}

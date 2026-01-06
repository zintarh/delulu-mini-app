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
      user: { select: { address: true, username: true } },
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
    .filter((s) => s.side)
    .reduce((acc, s) => acc + s.amount, 0);
  const doubterStake = stakes
    .filter((s) => !s.side)
    .reduce((acc, s) => acc + s.amount, 0);

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
  const deluluIds = [...new Set(stakes.map((s) => s.deluluId))];

  // Fetch full delulu data
  const delulus = await db.delulu.findMany({
    where: { id: { in: deluluIds } },
    include: {
      creator: { select: { username: true, pfpUrl: true, address: true } },
    },
    orderBy: { stakingDeadline: "asc" },
  });

  // Aggregate user's position for each delulu
  return delulus.map((delulu) => {
    const userStakes = stakes.filter((s) => s.deluluId === delulu.id);
    const believerStake = userStakes
      .filter((s) => s.side)
      .reduce((acc, s) => acc + s.amount, 0);
    const doubterStake = userStakes
      .filter((s) => !s.side)
      .reduce((acc, s) => acc + s.amount, 0);

    return {
      ...delulu,
      userPosition: { believerStake, doubterStake },
    };
  });
}

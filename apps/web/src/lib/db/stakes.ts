import { Prisma } from "@prisma/client";
import { db } from "./index";
import { findOrCreateUser } from "./users";
import type { CreateStakeInput } from "@/lib/validations/stake";

export type StakeWithDelulu = Prisma.StakeGetPayload<{
  include: { delulu: { select: { content: true; onChainId: true; stakingDeadline: true } } };
}>;

export async function createStake(input: CreateStakeInput) {
  console.log(`[createStake] Starting stake creation:`, {
    userAddress: input.userAddress,
    deluluId: input.deluluId,
    amount: input.amount,
    side: input.side,
    sideType: typeof input.side,
    txHash: input.txHash,
  });

  // Find or create user if they don't exist
  const user = await findOrCreateUser({
    address: input.userAddress,
  });

  console.log(`[createStake] User found/created:`, {
    userId: user.id,
    address: user.address,
  });

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
    console.error(`[createStake] Delulu not found: ${input.deluluId} (isOnChainId: ${isOnChainId})`);
    throw new Error("Delulu not found");
  }

  console.log(`[createStake] Found delulu:`, {
    deluluId: delulu.id,
    onChainId: delulu.onChainId.toString(),
  });

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

  console.log(`[createStake] Creating stake with data:`, {
    userId: user.id,
    deluluId: delulu.id,
    amount: input.amount,
    side: input.side,
    sideType: typeof input.side,
    txHash: input.txHash,
  });

  const stake = await db.stake.create({
    data: {
      userId: user.id,
      deluluId: delulu.id, // Always use the database ID
      amount: input.amount,
      side: input.side,
      txHash: input.txHash,
    },
  });

  console.log(`[createStake] Stake created successfully:`, {
    id: stake.id,
    userId: stake.userId,
    deluluId: stake.deluluId,
    amount: stake.amount,
    side: stake.side,
    sideType: typeof stake.side,
    txHash: stake.txHash,
  });

  // Update delulu stats
  const field = input.side ? "totalBelieverStake" : "totalDoubterStake";
  console.log(`[createStake] Updating delulu stats:`, {
    field,
    increment: input.amount,
    currentBeliever: delulu.totalBelieverStake,
    currentDoubter: delulu.totalDoubterStake,
  });

  await db.delulu.update({
    where: { id: delulu.id },
    data: { [field]: { increment: input.amount } },
  });

  console.log(`[createStake] Delulu stats updated successfully`);
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

  const deluluIds = [...new Set(stakes.map((s: (typeof stakes)[number]) => s.deluluId))];

  const delulus = await db.delulu.findMany({
    where: { id: { in: deluluIds } },
    include: {
      creator: { select: { username: true, pfpUrl: true, address: true } },
    },
    orderBy: { stakingDeadline: "asc" },
  });

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

import { db } from "./index";

export type ActivityType = "stake" | "claim" | "create";

export interface ActivityItem {
  id: string;
  type: ActivityType;
  userAddress: string;
  username: string | null;
  pfpUrl: string | null;
  deluluId: string;
  deluluContent: string | null;
  amount: number | null;
  side: boolean | null;
  createdAt: Date;
}

/**
 * Get recent activity feed
 */
export async function getRecentActivity(limit = 20): Promise<ActivityItem[]> {
  // Get recent stakes
  const stakes = await db.stake.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { address: true, username: true, pfpUrl: true } },
      delulu: { select: { id: true, content: true } },
    },
  });

  // Get recent claims
  const claims = await db.claim.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { address: true, username: true, pfpUrl: true } },
      delulu: { select: { id: true, content: true } },
    },
  });

  // Get recent delulu creations
  const creations = await db.delulu.findMany({
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { address: true, username: true, pfpUrl: true } },
    },
  });

  // Combine and format
  const activities: ActivityItem[] = [
    ...stakes.map((s: (typeof stakes)[number]) => ({
      id: s.id,
      type: "stake" as const,
      userAddress: s.user.address,
      username: s.user.username,
      pfpUrl: s.user.pfpUrl,
      deluluId: s.delulu.id,
      deluluContent: s.delulu.content,
      amount: s.amount,
      side: s.side,
      createdAt: s.createdAt,
    })),
    ...claims.map((c: (typeof claims)[number]) => ({
      id: c.id,
      type: "claim" as const,
      userAddress: c.user.address,
      username: c.user.username,
      pfpUrl: c.user.pfpUrl,
      deluluId: c.delulu.id,
      deluluContent: c.delulu.content,
      amount: c.amount,
      side: null,
      createdAt: c.createdAt,
    })),
    ...creations.map((d: (typeof creations)[number]) => ({
      id: d.id,
      type: "create" as const,
      userAddress: d.creator.address,
      username: d.creator.username,
      pfpUrl: d.creator.pfpUrl,
      deluluId: d.id,
      deluluContent: d.content,
      amount: null,
      side: null,
      createdAt: d.createdAt,
    })),
  ];

  // Sort by date and limit
  return activities
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

/**
 * Get activity for a specific user
 */
export async function getUserActivity(
  address: string,
  limit = 20
): Promise<ActivityItem[]> {
  const user = await db.user.findUnique({
    where: { address: address.toLowerCase() },
  });

  if (!user) return [];

  const stakes = await db.stake.findMany({
    where: { userId: user.id },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      delulu: { select: { id: true, content: true } },
    },
  });

  const claims = await db.claim.findMany({
    where: { userId: user.id },
    take: limit,
    orderBy: { createdAt: "desc" },
    include: {
      delulu: { select: { id: true, content: true } },
    },
  });

  const creations = await db.delulu.findMany({
    where: { creatorId: user.id },
    take: limit,
    orderBy: { createdAt: "desc" },
  });

  const activities: ActivityItem[] = [
    ...stakes.map((s: (typeof stakes)[number]) => ({
      id: s.id,
      type: "stake" as const,
      userAddress: address,
      username: null,
      pfpUrl: null,
      deluluId: s.delulu.id,
      deluluContent: s.delulu.content,
      amount: s.amount,
      side: s.side,
      createdAt: s.createdAt,
    })),
    ...claims.map((c: (typeof claims)[number]) => ({
      id: c.id,
      type: "claim" as const,
      userAddress: address,
      username: null,
      pfpUrl: null,
      deluluId: c.delulu.id,
      deluluContent: c.delulu.content,
      amount: c.amount,
      side: null,
      createdAt: c.createdAt,
    })),
    ...creations.map((d: (typeof creations)[number]) => ({
      id: d.id,
      type: "create" as const,
      userAddress: address,
      username: null,
      pfpUrl: null,
      deluluId: d.id,
      deluluContent: d.content,
      amount: null,
      side: null,
      createdAt: d.createdAt,
    })),
  ];

  return activities
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, limit);
}

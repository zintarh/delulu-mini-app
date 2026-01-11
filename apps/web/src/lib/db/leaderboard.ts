import { db } from "./index";

interface LeaderboardEntry {
  address: string;
  username: string | null;
  pfpUrl: string | null;
  value: number;
}

/**
 * Get top stakers by total amount staked
 */
export async function getTopStakers(limit = 10): Promise<LeaderboardEntry[]> {
  const results = await db.$queryRaw<
    { address: string; username: string | null; pfpUrl: string | null; total: number }[]
  >`
    SELECT 
      u.address,
      u.username,
      u."pfpUrl",
      COALESCE(SUM(s.amount), 0)::float as total
    FROM "User" u
    LEFT JOIN "Stake" s ON s."userId" = u.id
    GROUP BY u.id, u.address, u.username, u."pfpUrl"
    HAVING COALESCE(SUM(s.amount), 0) > 0
    ORDER BY total DESC
    LIMIT ${limit}
  `;

  return results.map((r: (typeof results)[number]) => ({
    address: r.address,
    username: r.username,
    pfpUrl: r.pfpUrl,
    value: r.total,
  }));
}

/**
 * Get top earners by total claimed amount
 */
export async function getTopEarners(limit = 10): Promise<LeaderboardEntry[]> {
  const results = await db.$queryRaw<
    { address: string; username: string | null; pfpUrl: string | null; total: number }[]
  >`
    SELECT 
      u.address,
      u.username,
      u."pfpUrl",
      COALESCE(SUM(c.amount), 0)::float as total
    FROM "User" u
    LEFT JOIN "Claim" c ON c."userId" = u.id
    GROUP BY u.id, u.address, u.username, u."pfpUrl"
    HAVING COALESCE(SUM(c.amount), 0) > 0
    ORDER BY total DESC
    LIMIT ${limit}
  `;

  return results.map((r: (typeof results)[number]) => ({
    address: r.address,
    username: r.username,
    pfpUrl: r.pfpUrl,
    value: r.total,
  }));
}

/**
 * Get most active users by number of stakes
 */
export async function getMostActiveUsers(limit = 10): Promise<LeaderboardEntry[]> {
  const results = await db.$queryRaw<
    { address: string; username: string | null; pfpUrl: string | null; count: number }[]
  >`
    SELECT 
      u.address,
      u.username,
      u."pfpUrl",
      COUNT(s.id)::int as count
    FROM "User" u
    LEFT JOIN "Stake" s ON s."userId" = u.id
    GROUP BY u.id, u.address, u.username, u."pfpUrl"
    HAVING COUNT(s.id) > 0
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  return results.map((r: (typeof results)[number]) => ({
    address: r.address,
    username: r.username,
    pfpUrl: r.pfpUrl,
    value: r.count,
  }));
}

/**
 * Get top creators by number of delulus created
 */
export async function getTopCreators(limit = 10): Promise<LeaderboardEntry[]> {
  const results = await db.$queryRaw<
    { address: string; username: string | null; pfpUrl: string | null; count: number }[]
  >`
    SELECT 
      u.address,
      u.username,
      u."pfpUrl",
      COUNT(d.id)::int as count
    FROM "User" u
    LEFT JOIN "Delulu" d ON d."creatorId" = u.id
    GROUP BY u.id, u.address, u.username, u."pfpUrl"
    HAVING COUNT(d.id) > 0
    ORDER BY count DESC
    LIMIT ${limit}
  `;

  return results.map((r: (typeof results)[number]) => ({
    address: r.address,
    username: r.username,
    pfpUrl: r.pfpUrl,
    value: r.count,
  }));
}

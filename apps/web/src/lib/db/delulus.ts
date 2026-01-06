import { db } from "./index";

export type CreateDeluluInput = {
  onChainId: bigint;
  contentHash: string;
  content?: string;
  creatorAddress: string;
  stakingDeadline: Date;
  resolutionDeadline: Date;
  bgImageUrl?: string;
  gatekeeper?: {
    enabled: boolean;
    type?: string;
    value?: string;
    label?: string;
  };
};

export async function createDelulu(input: CreateDeluluInput) {
  const user = await db.user.findUnique({
    where: { address: input.creatorAddress.toLowerCase() },
  });

  if (!user) {
    throw new Error("User not found");
  }

  return db.delulu.create({
    data: {
      onChainId: input.onChainId,
      contentHash: input.contentHash,
      content: input.content,
      creatorId: user.id,
      creatorAddress: input.creatorAddress.toLowerCase(),
      stakingDeadline: input.stakingDeadline,
      resolutionDeadline: input.resolutionDeadline,
      gatekeeperEnabled: input.gatekeeper?.enabled ?? false,
      gatekeeperType: input.gatekeeper?.type,
      gatekeeperValue: input.gatekeeper?.value,
      gatekeeperLabel: input.gatekeeper?.label,
      bgImageUrl: input.bgImageUrl || `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/templates/t0.png`,
    },
  });
}

export async function getDelulus(options?: {
  limit?: number;
  cursor?: string;
  creatorAddress?: string;
  includeResolved?: boolean;
}) {
  const { limit = 20, cursor, creatorAddress, includeResolved = true } = options ?? {};

  const where = {
    ...(creatorAddress && { creatorAddress: creatorAddress.toLowerCase() }),
    ...(!includeResolved && { isResolved: false, isCancelled: false }),
  };

  return db.delulu.findMany({
    where,
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { username: true, pfpUrl: true } },
    },
  });
}

export async function getDeluluById(id: string) {
  return db.delulu.findUnique({
    where: { id },
    include: {
      creator: { select: { username: true, pfpUrl: true } },
      stakes: true,
    },
  });
}

export async function getDeluluByOnChainId(onChainId: bigint) {
  return db.delulu.findUnique({
    where: { onChainId },
    include: {
      creator: { select: { username: true, pfpUrl: true, address: true } },
      stakes: true,
    },
  });
}

export async function updateDeluluStats(
  id: string,
  data: { totalBelieverStake?: number; totalDoubterStake?: number }
) {
  return db.delulu.update({
    where: { id },
    data,
  });
}

export async function resolveDelulu(id: string, outcome: boolean) {
  return db.delulu.update({
    where: { id },
    data: { isResolved: true, outcome },
  });
}

export async function cancelDelulu(id: string) {
  return db.delulu.update({
    where: { id },
    data: { isCancelled: true },
  });
}

export async function getDelulusByUser(address: string) {
  return db.delulu.findMany({
    where: { creatorAddress: address.toLowerCase() },
    orderBy: { createdAt: "desc" },
  });
}

export async function getEndingSoonDelulus(hoursFromNow = 24) {
  const deadline = new Date(Date.now() + hoursFromNow * 60 * 60 * 1000);

  return db.delulu.findMany({
    where: {
      stakingDeadline: { lte: deadline, gt: new Date() },
      isResolved: false,
      isCancelled: false,
    },
    orderBy: { stakingDeadline: "asc" },
    include: {
      creator: { select: { username: true, pfpUrl: true } },
    },
  });
}

export type DeluluState = "open" | "locked" | "resolved" | "cancelled";

/**
 * Get delulus filtered by state
 * - open: staking still active (stakingDeadline > now, not resolved/cancelled)
 * - locked: staking closed, awaiting resolution
 * - resolved: outcome determined
 * - cancelled: cancelled by admin
 */
export async function getDelulusByState(
  state: DeluluState,
  options?: { limit?: number; cursor?: string }
) {
  const { limit = 20, cursor } = options ?? {};
  const now = new Date();

  let where = {};

  switch (state) {
    case "open":
      where = {
        stakingDeadline: { gt: now },
        isResolved: false,
        isCancelled: false,
      };
      break;
    case "locked":
      where = {
        stakingDeadline: { lte: now },
        isResolved: false,
        isCancelled: false,
      };
      break;
    case "resolved":
      where = { isResolved: true };
      break;
    case "cancelled":
      where = { isCancelled: true };
      break;
  }

  return db.delulu.findMany({
    where,
    take: limit,
    skip: cursor ? 1 : 0,
    cursor: cursor ? { id: cursor } : undefined,
    orderBy: { createdAt: "desc" },
    include: {
      creator: { select: { username: true, pfpUrl: true } },
    },
  });
}

// Types for trending query results
interface TrendingScoreRow {
  delulu_id: string;
  score: number;
}

// Include for trending delulus
const trendingDeluluInclude = {
  creator: { select: { username: true, pfpUrl: true, address: true } },
} as const;

/**
 * Get trending delulus based on weighted activity score over last 24 hours.
 * Score = (Normalized Volume * 0.4) + (Unique Users * 0.4) + (Tx Count * 0.2)
 */
export async function getTrendingDelulus(limit = 10) {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Raw SQL for complex aggregation with normalized scoring
  const trendingScores = await db.$queryRaw<TrendingScoreRow[]>`
    WITH stake_stats AS (
      SELECT 
        s."deluluId" as delulu_id,
        COALESCE(SUM(s.amount), 0) as total_volume,
        COUNT(DISTINCT s."userId") as unique_users,
        COUNT(*) as tx_count
      FROM "Stake" s
      INNER JOIN "Delulu" d ON s."deluluId" = d.id
      WHERE s."createdAt" >= ${oneDayAgo}
        AND d."isResolved" = false
        AND d."isCancelled" = false
        AND d."stakingDeadline" > NOW()
      GROUP BY s."deluluId"
    ),
    normalized_stats AS (
      SELECT 
        delulu_id,
        total_volume,
        unique_users,
        tx_count,
        CASE WHEN MAX(total_volume) OVER () > 0 
          THEN total_volume / MAX(total_volume) OVER () 
          ELSE 0 
        END as norm_volume,
        CASE WHEN MAX(unique_users) OVER () > 0 
          THEN unique_users::float / MAX(unique_users) OVER () 
          ELSE 0 
        END as norm_users,
        CASE WHEN MAX(tx_count) OVER () > 0 
          THEN tx_count::float / MAX(tx_count) OVER () 
          ELSE 0 
        END as norm_tx
      FROM stake_stats
    )
    SELECT 
      delulu_id,
      (norm_volume * 0.4 + norm_users * 0.4 + norm_tx * 0.2)::float as score
    FROM normalized_stats
    ORDER BY score DESC
    LIMIT ${limit}
  `;

  if (trendingScores.length === 0) {
    return [];
  }

  // Extract IDs preserving order
  const orderedIds = trendingScores.map((row: TrendingScoreRow) => row.delulu_id);

  // Fetch full delulu data
  const delulus = await db.delulu.findMany({
    where: { id: { in: orderedIds } },
    include: trendingDeluluInclude,
  });

  // Create lookup map for O(1) access
  type DeluluWithCreator = (typeof delulus)[number];
  const deluluMap = new Map<string, DeluluWithCreator>(
    delulus.map((d: DeluluWithCreator) => [d.id, d])
  );
  const scoreMap = new Map<string, number>(
    trendingScores.map((row: TrendingScoreRow) => [row.delulu_id, row.score])
  );

  // Return in trending order with scores attached
  type TrendingDelulu = DeluluWithCreator & { trendingScore: number };
  const result: TrendingDelulu[] = [];

  for (const id of orderedIds) {
    const delulu = deluluMap.get(id);
    if (delulu) {
      result.push({
        ...delulu,
        trendingScore: scoreMap.get(id) ?? 0,
      });
    }
  }

  return result;
}

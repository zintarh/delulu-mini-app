import { getSubgraphUrlForChain } from "@/lib/constant";
import { CELO_MAINNET_ID } from "@/lib/constant";
import { getDashboardNextMilestones } from "@/lib/community/milestone-submit-eligibility";

export type CommunityCampaignLeaderboardRow = {
  rank: number;
  wallet_address: string;
  username?: string | null;
  points_total: number;
  current_streak: number;
  joined_at: string | null;
  is_community_member: boolean;
};

export type CommunityCampaignMilestoneRow = {
  milestone_id: number;
  label: string;
  deadline: string;
  start_time: string;
  completed: boolean;
  is_overdue: boolean;
};

export type JoinedCampaignDashboardRow = {
  challenge_id: number;
  milestone_count: number;
  completed_count: number;
  next_milestones: CommunityCampaignMilestoneRow[];
};

type SubgraphParticipant = {
  participantAddress: string;
  pointsTotal: string;
  streak: string;
  joinedAt: string;
  completedMilestoneCount?: string;
  participant?: { username?: string | null } | null;
};

type SubgraphMilestone = {
  milestoneId: string;
  milestoneURI: string;
  deadline: string;
  startTime: string;
};

type SubgraphCompletion = {
  milestoneId: string;
  participantAddress: string;
};

async function fetchSubgraph<T>(
  query: string,
  variables: Record<string, unknown>,
  options?: { fresh?: boolean },
): Promise<T> {
  const url =
    getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) throw new Error("Subgraph URL not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    ...(options?.fresh ? { cache: "no-store" as const } : { next: { revalidate: 15 } }),
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Subgraph query failed");
  }
  return json.data as T;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const LEADERBOARD_QUERY = `
  query CommunityCampaignLeaderboard($challengeId: BigInt!, $first: Int!, $skip: Int!) {
    communityCampaignParticipants(
      first: $first
      skip: $skip
      orderBy: pointsTotal
      orderDirection: desc
      where: { challengeId: $challengeId }
    ) {
      participantAddress
      pointsTotal
      streak
      joinedAt
      participant {
        username
      }
    }
  }
`;

const JOINED_QUERY = `
  query CommunityCampaignJoined($challengeId: BigInt!, $address: String!) {
    communityCampaignParticipants(
      where: { challengeId: $challengeId, participantAddress: $address }
      first: 1
    ) {
      id
      pointsTotal
    }
  }
`;

const PARTICIPANT_COUNT_QUERY = `
  query CommunityCampaignParticipantCount($challengeId: BigInt!) {
    communityCampaignParticipants(
      where: { challengeId: $challengeId }
      first: 1000
    ) {
      id
    }
  }
`;

const JOINED_CHALLENGE_IDS_QUERY = `
  query JoinedCommunityCampaigns($address: String!, $challengeIds: [BigInt!]!) {
    communityCampaignParticipants(
      where: { participantAddress: $address, challengeId_in: $challengeIds }
      first: 200
    ) {
      challengeId
      pointsTotal
      completedMilestoneCount
    }
  }
`;

const CHALLENGE_MILESTONE_COUNT_QUERY = `
  query CommunityCampaignMilestoneCount($challengeId: ID!) {
    challenge(id: $challengeId) {
      milestoneCount
    }
  }
`;

const CAMPAIGN_MILESTONES_QUERY = `
  query CommunityCampaignMilestones($challengeId: BigInt!) {
    communityCampaignMilestones(
      where: { challengeId: $challengeId }
      orderBy: milestoneId
      orderDirection: asc
      first: 50
    ) {
      milestoneId
      milestoneURI
      deadline
      startTime
    }
  }
`;

const USER_MILESTONE_COMPLETIONS_QUERY = `
  query UserMilestoneCompletions($challengeId: BigInt!, $address: String!) {
    communityCampaignMilestoneCompletions(
      where: { challengeId: $challengeId, participantAddress: $address }
      first: 100
    ) {
      milestoneId
    }
  }
`;

const JOINED_PARTICIPANTS_QUERY = `
  query JoinedParticipantsForDashboard($address: String!) {
    communityCampaignParticipants(
      where: { participantAddress: $address }
      first: 50
      orderBy: joinedAt
      orderDirection: desc
    ) {
      challengeId
      pointsTotal
      completedMilestoneCount
    }
  }
`;

const MONTHLY_CAMPAIGN_PARTICIPANTS_QUERY = `
  query MonthlyCampaignParticipants($since: BigInt!) {
    communityCampaignParticipants(
      where: { joinedAt_gte: $since }
      first: 1000
      orderBy: pointsTotal
      orderDirection: desc
    ) {
      participantAddress
      pointsTotal
      participant {
        username
      }
    }
  }
`;

export type MonthlyCampaignPointsRow = {
  wallet_address: string;
  points_total: number;
  username: string | null;
};

/**
 * Every on-chain community-campaign participation joined since `sinceUnixSeconds`,
 * summed per wallet (a wallet may have joined more than one campaign this month).
 */
export async function fetchMonthlyCampaignPointsFromGraph(
  sinceUnixSeconds: number,
): Promise<MonthlyCampaignPointsRow[]> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{
        participantAddress: string;
        pointsTotal: string;
        participant: { username: string | null } | null;
      }>;
    }>(MONTHLY_CAMPAIGN_PARTICIPANTS_QUERY, { since: sinceUnixSeconds.toString() });

    const byWallet = new Map<string, { points: number; username: string | null }>();
    for (const row of data.communityCampaignParticipants ?? []) {
      const wallet = row.participantAddress.toLowerCase();
      const existing = byWallet.get(wallet);
      const points = Number(row.pointsTotal ?? "0");
      if (existing) {
        existing.points += points;
      } else {
        byWallet.set(wallet, { points, username: row.participant?.username ?? null });
      }
    }

    return Array.from(byWallet.entries()).map(([wallet_address, v]) => ({
      wallet_address,
      points_total: v.points,
      username: v.username,
    }));
  } catch {
    return [];
  }
}

const BATCH_PARTICIPANT_COUNTS_QUERY = `
  query BatchParticipantCounts($challengeIds: [BigInt!]!) {
    communityCampaignParticipants(
      where: { challengeId_in: $challengeIds }
      first: 1000
    ) {
      challengeId
      id
    }
  }
`;

const BATCH_MILESTONE_COUNTS_QUERY = `
  query BatchMilestoneCounts($challengeIds: [BigInt!]!) {
    communityCampaignMilestones(
      where: { challengeId_in: $challengeIds }
      first: 1000
    ) {
      challengeId
    }
  }
`;

const BATCH_CAMPAIGN_MILESTONES_QUERY = `
  query BatchCampaignMilestones($challengeIds: [BigInt!]!) {
    communityCampaignMilestones(
      where: { challengeId_in: $challengeIds }
      orderBy: milestoneId
      orderDirection: asc
      first: 1000
    ) {
      challengeId
      milestoneId
      milestoneURI
      deadline
      startTime
    }
  }
`;

const BATCH_MILESTONE_COMPLETIONS_QUERY = `
  query BatchMilestoneCompletions($challengeIds: [BigInt!]!, $address: String!) {
    communityCampaignMilestoneCompletions(
      where: { challengeId_in: $challengeIds, participantAddress: $address }
      first: 1000
    ) {
      challengeId
      milestoneId
    }
  }
`;

export async function fetchCommunityCampaignLeaderboardFromGraph(
  challengeId: number,
  memberWallets: Set<string>,
  page: number = 0,
  pageSize: number = 20,
): Promise<CommunityCampaignLeaderboardRow[]> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: SubgraphParticipant[];
    }>(LEADERBOARD_QUERY, {
      challengeId: challengeId.toString(),
      first: pageSize,
      skip: page * pageSize,
    });

    return (data.communityCampaignParticipants ?? []).map((row, index) => {
      const wallet = row.participantAddress.toLowerCase();
      return {
        rank: page * pageSize + index + 1,
        wallet_address: wallet,
        username: row.participant?.username ?? null,
        points_total: Number(row.pointsTotal),
        current_streak: Number(row.streak),
        joined_at: row.joinedAt
          ? new Date(Number(row.joinedAt) * 1000).toISOString()
          : null,
        is_community_member: memberWallets.has(wallet),
      };
    });
  } catch {
    return [];
  }
}

export async function isJoinedCommunityCampaignOnGraph(
  challengeId: number,
  walletAddress: string,
): Promise<{ joined: boolean; pointsTotal: number }> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{ id: string; pointsTotal: string }>;
    }>(JOINED_QUERY, {
      challengeId: challengeId.toString(),
      address: walletAddress.toLowerCase(),
    });
    const row = data.communityCampaignParticipants?.[0];
    return {
      joined: Boolean(row),
      pointsTotal: row ? Number(row.pointsTotal) : 0,
    };
  } catch {
    return { joined: false, pointsTotal: 0 };
  }
}

export async function fetchCommunityCampaignParticipantCountFromGraph(
  challengeId: number,
): Promise<number> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{ id: string }>;
    }>(PARTICIPANT_COUNT_QUERY, { challengeId: challengeId.toString() });
    return data.communityCampaignParticipants?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function fetchJoinedChallengeIdsFromGraph(
  walletAddress: string,
  challengeIds: number[],
  fresh = false,
): Promise<Set<number>> {
  if (challengeIds.length === 0) return new Set();
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{ challengeId: string }>;
    }>(
      JOINED_CHALLENGE_IDS_QUERY,
      {
        address: walletAddress.toLowerCase(),
        challengeIds: challengeIds.map(String),
      },
      { fresh },
    );
    return new Set(
      (data.communityCampaignParticipants ?? []).map((r) => Number(r.challengeId)),
    );
  } catch {
    return new Set();
  }
}

export async function fetchCommunityCampaignMilestoneCountFromGraph(
  challengeId: number,
  fresh = false,
): Promise<number> {
  try {
    const [countData, milestonesData] = await Promise.all([
      fetchSubgraph<{
        challenge: { milestoneCount: string } | null;
      }>(CHALLENGE_MILESTONE_COUNT_QUERY, { challengeId: challengeId.toString() }, { fresh }),
      fetchSubgraph<{ communityCampaignMilestones: Array<{ milestoneId: string }> }>(
        CAMPAIGN_MILESTONES_QUERY,
        { challengeId: challengeId.toString() },
        { fresh },
      ),
    ]);
    const fromChallenge = Number(countData.challenge?.milestoneCount ?? 0);
    const fromEntities = milestonesData.communityCampaignMilestones?.length ?? 0;
    return Math.max(fromChallenge, fromEntities);
  } catch {
    return 0;
  }
}

export async function fetchCommunityCampaignMilestonesFromGraph(
  challengeId: number,
  walletAddress?: string,
  fresh = false,
): Promise<CommunityCampaignMilestoneRow[]> {
  try {
    const [milestonesData, completionsData] = await Promise.all([
      fetchSubgraph<{ communityCampaignMilestones: SubgraphMilestone[] }>(
        CAMPAIGN_MILESTONES_QUERY,
        { challengeId: challengeId.toString() },
        { fresh },
      ),
      walletAddress
        ? fetchSubgraph<{ communityCampaignMilestoneCompletions: SubgraphCompletion[] }>(
            USER_MILESTONE_COMPLETIONS_QUERY,
            { challengeId: challengeId.toString(), address: walletAddress.toLowerCase() },
            { fresh },
          )
        : Promise.resolve({ communityCampaignMilestoneCompletions: [] }),
    ]);

    const completedIds = new Set(
      (completionsData.communityCampaignMilestoneCompletions ?? []).map((c) =>
        Number(c.milestoneId),
      ),
    );
    const now = Date.now();

    return (milestonesData.communityCampaignMilestones ?? []).map((m) => {
      const deadlineMs = Number(m.deadline) * 1000;
      const completed = completedIds.has(Number(m.milestoneId));
      return {
        milestone_id: Number(m.milestoneId),
        label: m.milestoneURI,
        deadline: new Date(deadlineMs).toISOString(),
        start_time: new Date(Number(m.startTime) * 1000).toISOString(),
        completed,
        is_overdue: !completed && deadlineMs < now,
      };
    });
  } catch {
    return [];
  }
}

export async function fetchBatchCampaignStats(
  challengeIds: number[],
): Promise<Map<number, { participantCount: number; milestoneCount: number }>> {
  if (challengeIds.length === 0) return new Map();
  try {
    const ids = challengeIds.map(String);
    const [participantData, milestoneData] = await Promise.all([
      fetchSubgraph<{ communityCampaignParticipants: Array<{ challengeId: string; id: string }> }>(
        BATCH_PARTICIPANT_COUNTS_QUERY,
        { challengeIds: ids },
      ),
      fetchSubgraph<{ communityCampaignMilestones: Array<{ challengeId: string }> }>(
        BATCH_MILESTONE_COUNTS_QUERY,
        { challengeIds: ids },
      ),
    ]);

    const participantCounts = new Map<number, number>();
    for (const p of participantData.communityCampaignParticipants ?? []) {
      const cid = Number(p.challengeId);
      participantCounts.set(cid, (participantCounts.get(cid) ?? 0) + 1);
    }

    const milestoneCounts = new Map<number, number>();
    for (const m of milestoneData.communityCampaignMilestones ?? []) {
      const cid = Number(m.challengeId);
      milestoneCounts.set(cid, (milestoneCounts.get(cid) ?? 0) + 1);
    }

    const result = new Map<number, { participantCount: number; milestoneCount: number }>();
    for (const cid of challengeIds) {
      result.set(cid, {
        participantCount: participantCounts.get(cid) ?? 0,
        milestoneCount: milestoneCounts.get(cid) ?? 0,
      });
    }
    return result;
  } catch {
    return new Map();
  }
}

async function fetchBatchCampaignMilestones(
  challengeIds: number[],
  walletAddress: string,
): Promise<Map<number, CommunityCampaignMilestoneRow[]>> {
  if (challengeIds.length === 0) return new Map();
  try {
    const ids = challengeIds.map(String);
    const [milestonesData, completionsData] = await Promise.all([
      fetchSubgraph<{ communityCampaignMilestones: Array<SubgraphMilestone & { challengeId: string }> }>(
        BATCH_CAMPAIGN_MILESTONES_QUERY,
        { challengeIds: ids },
      ),
      fetchSubgraph<{ communityCampaignMilestoneCompletions: Array<SubgraphCompletion & { challengeId: string }> }>(
        BATCH_MILESTONE_COMPLETIONS_QUERY,
        { challengeIds: ids, address: walletAddress.toLowerCase() },
      ),
    ]);

    const completedByChallenge = new Map<number, Set<number>>();
    for (const c of completionsData.communityCampaignMilestoneCompletions ?? []) {
      const cid = Number(c.challengeId);
      if (!completedByChallenge.has(cid)) completedByChallenge.set(cid, new Set());
      completedByChallenge.get(cid)!.add(Number(c.milestoneId));
    }

    const result = new Map<number, CommunityCampaignMilestoneRow[]>();
    const now = Date.now();
    for (const m of milestonesData.communityCampaignMilestones ?? []) {
      const cid = Number(m.challengeId);
      if (!result.has(cid)) result.set(cid, []);
      const deadlineMs = Number(m.deadline) * 1000;
      const completed = completedByChallenge.get(cid)?.has(Number(m.milestoneId)) ?? false;
      result.get(cid)!.push({
        milestone_id: Number(m.milestoneId),
        label: m.milestoneURI,
        deadline: new Date(deadlineMs).toISOString(),
        start_time: new Date(Number(m.startTime) * 1000).toISOString(),
        completed,
        is_overdue: !completed && deadlineMs < now,
      });
    }
    return result;
  } catch {
    return new Map();
  }
}

export async function fetchJoinedCampaignDashboardFromGraph(
  walletAddress: string,
  challengeIdToCampaign: Map<number, {
    id: string;
    title: string;
    community: { name: string; slug: string };
    cover_image_url: string | null;
    display_ends_at: string | null;
    duration_days: number;
    proof_type: string;
    live_camera_duration_seconds: number | null;
    is_free_to_join: boolean;
    join_token: string;
    join_amount: number;
    forfeit_pct: number;
  }>,
): Promise<
  Array<
    JoinedCampaignDashboardRow & {
      campaign_id: string;
      title: string;
      community: { name: string; slug: string };
      cover_image_url: string | null;
      display_ends_at: string | null;
      duration_days: number;
      proof_type: string;
      live_camera_duration_seconds: number | null;
      is_free_to_join: boolean;
      join_token: string;
      join_amount: number;
      forfeit_pct: number;
      participant_count: number;
    }
  >
> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{
        challengeId: string;
        completedMilestoneCount: string;
      }>;
    }>(JOINED_PARTICIPANTS_QUERY, { address: walletAddress.toLowerCase() }, { fresh: true });

    const participants = data.communityCampaignParticipants ?? [];
    const relevantChallengeIds = participants
      .map((p) => Number(p.challengeId))
      .filter((cid) => challengeIdToCampaign.has(cid));

    const [batchedMilestones, batchStats] = await Promise.all([
      fetchBatchCampaignMilestones(relevantChallengeIds, walletAddress),
      fetchBatchCampaignStats(relevantChallengeIds),
    ]);

    const rows = participants.map((p) => {
      const challengeId = Number(p.challengeId);
      const meta = challengeIdToCampaign.get(challengeId);
      if (!meta) return null;

      const milestones = batchedMilestones.get(challengeId) ?? [];
      const completedCount = Number(p.completedMilestoneCount ?? 0);
      const next_milestones = getDashboardNextMilestones(milestones);

      return {
        campaign_id: meta.id,
        challenge_id: challengeId,
        title: meta.title,
        community: meta.community,
        cover_image_url: meta.cover_image_url,
        display_ends_at: meta.display_ends_at,
        duration_days: meta.duration_days,
        proof_type: meta.proof_type,
        live_camera_duration_seconds: meta.live_camera_duration_seconds,
        is_free_to_join: meta.is_free_to_join,
        join_token: meta.join_token,
        join_amount: meta.join_amount,
        forfeit_pct: meta.forfeit_pct,
        participant_count: batchStats.get(challengeId)?.participantCount ?? 0,
        milestone_count: milestones.length,
        completed_count: completedCount,
        next_milestones,
      };
    });

    return rows.filter((r): r is NonNullable<typeof r> => r != null);
  } catch {
    return [];
  }
}

/** Poll subgraph until at least minCount milestones are indexed. */
export async function waitForGraphMilestoneCount(
  challengeId: number,
  minCount = 1,
  { attempts = 15, delayMs = 2500 } = {},
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const count = await fetchCommunityCampaignMilestoneCountFromGraph(challengeId, true);
    if (count >= minCount) return true;
    if (i < attempts - 1) await sleep(delayMs);
  }
  return false;
}

/** Poll subgraph until a milestone shows completed (post-tx indexing lag). */
export async function waitForMilestoneCompletionInGraph(
  challengeId: number,
  walletAddress: string,
  milestoneId: number,
  { attempts = 12, delayMs = 2500 } = {},
): Promise<boolean> {
  for (let i = 0; i < attempts; i++) {
    const milestones = await fetchCommunityCampaignMilestonesFromGraph(
      challengeId,
      walletAddress,
      true,
    );
    if (milestones.some((m) => m.milestone_id === milestoneId && m.completed)) {
      return true;
    }
    if (i < attempts - 1) await sleep(delayMs);
  }
  return false;
}

/** Poll subgraph until participant appears (post-join indexing lag). */
export async function waitForJoinInGraph(
  walletAddress: string,
  challengeIds: number[],
  { attempts = 10, delayMs = 2000 } = {},
): Promise<boolean> {
  if (challengeIds.length === 0) return false;
  for (let i = 0; i < attempts; i++) {
    const joined = await fetchJoinedChallengeIdsFromGraph(walletAddress, challengeIds, true);
    if (joined.size > 0) return true;
    if (i < attempts - 1) await sleep(delayMs);
  }
  return false;
}

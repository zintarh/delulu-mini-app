import { getSubgraphUrlForChain } from "@/lib/constant";
import { CELO_MAINNET_ID } from "@/lib/constant";

export type CommunityCampaignLeaderboardRow = {
  rank: number;
  wallet_address: string;
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

async function fetchSubgraph<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const url =
    getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) throw new Error("Subgraph URL not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 15 },
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Subgraph query failed");
  }
  return json.data as T;
}

const LEADERBOARD_QUERY = `
  query CommunityCampaignLeaderboard($challengeId: BigInt!, $first: Int!) {
    communityCampaignParticipants(
      first: $first
      orderBy: pointsTotal
      orderDirection: desc
      where: { challengeId: $challengeId }
    ) {
      participantAddress
      pointsTotal
      streak
      joinedAt
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

export async function fetchCommunityCampaignLeaderboardFromGraph(
  challengeId: number,
  memberWallets: Set<string>,
): Promise<CommunityCampaignLeaderboardRow[]> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: SubgraphParticipant[];
    }>(LEADERBOARD_QUERY, { challengeId: challengeId.toString(), first: 100 });

    return (data.communityCampaignParticipants ?? []).map((row, index) => {
      const wallet = row.participantAddress.toLowerCase();
      return {
        rank: index + 1,
        wallet_address: wallet,
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
): Promise<Set<number>> {
  if (challengeIds.length === 0) return new Set();
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{ challengeId: string }>;
    }>(JOINED_CHALLENGE_IDS_QUERY, {
      address: walletAddress.toLowerCase(),
      challengeIds: challengeIds.map(String),
    });
    return new Set(
      (data.communityCampaignParticipants ?? []).map((r) => Number(r.challengeId)),
    );
  } catch {
    return new Set();
  }
}

export async function fetchCommunityCampaignMilestoneCountFromGraph(
  challengeId: number,
): Promise<number> {
  try {
    const data = await fetchSubgraph<{
      challenge: { milestoneCount: string } | null;
    }>(CHALLENGE_MILESTONE_COUNT_QUERY, { challengeId: challengeId.toString() });
    return Number(data.challenge?.milestoneCount ?? 0);
  } catch {
    return 0;
  }
}

export async function fetchCommunityCampaignMilestonesFromGraph(
  challengeId: number,
  walletAddress?: string,
): Promise<CommunityCampaignMilestoneRow[]> {
  try {
    const [milestonesData, completionsData] = await Promise.all([
      fetchSubgraph<{ communityCampaignMilestones: SubgraphMilestone[] }>(
        CAMPAIGN_MILESTONES_QUERY,
        { challengeId: challengeId.toString() },
      ),
      walletAddress
        ? fetchSubgraph<{ communityCampaignMilestoneCompletions: SubgraphCompletion[] }>(
            USER_MILESTONE_COMPLETIONS_QUERY,
            { challengeId: challengeId.toString(), address: walletAddress.toLowerCase() },
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

export async function fetchJoinedCampaignDashboardFromGraph(
  walletAddress: string,
  challengeIdToCampaign: Map<number, { id: string; title: string; community: { name: string; slug: string }; cover_image_url: string | null; display_ends_at: string | null; duration_days: number }>,
): Promise<
  Array<
    JoinedCampaignDashboardRow & {
      campaign_id: string;
      title: string;
      community: { name: string; slug: string };
      cover_image_url: string | null;
      display_ends_at: string | null;
      duration_days: number;
    }
  >
> {
  try {
    const data = await fetchSubgraph<{
      communityCampaignParticipants: Array<{
        challengeId: string;
        completedMilestoneCount: string;
      }>;
    }>(JOINED_PARTICIPANTS_QUERY, { address: walletAddress.toLowerCase() });

    const rows = await Promise.all(
      (data.communityCampaignParticipants ?? []).map(async (p) => {
        const challengeId = Number(p.challengeId);
        const meta = challengeIdToCampaign.get(challengeId);
        if (!meta) return null;

        const milestones = await fetchCommunityCampaignMilestonesFromGraph(
          challengeId,
          walletAddress,
        );
        const completedCount = Number(p.completedMilestoneCount ?? 0);
        const pending = milestones.filter((m) => !m.completed);
        const next_milestones = pending.slice(0, 2);

        return {
          campaign_id: meta.id,
          challenge_id: challengeId,
          title: meta.title,
          community: meta.community,
          cover_image_url: meta.cover_image_url,
          display_ends_at: meta.display_ends_at,
          duration_days: meta.duration_days,
          milestone_count: milestones.length,
          completed_count: completedCount,
          next_milestones,
        };
      }),
    );

    return rows.filter((r): r is NonNullable<typeof r> => r != null);
  } catch {
    return [];
  }
}

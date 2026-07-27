import { getSubgraphUrlForChain, CELO_MAINNET_ID } from "@/lib/constant";

export type ActivityDay = {
  date: string;
  label: string;
  count: number;
};

export type WeeklyActivityResult = {
  weekStart: string;
  weekEnd: string;
  days: ActivityDay[];
  total: number;
};

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

async function fetchSubgraph<T>(
  query: string,
  variables: Record<string, unknown>,
): Promise<T> {
  const url =
    getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) throw new Error("Subgraph URL not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Subgraph query failed");
  }
  return json.data as T;
}

/** Campaign milestone proofs + successful forfeit period resolutions (not delulu milestones). */
const WEEKLY_ACTIVITY_QUERY = `
  query WeeklyUserActivity(
    $address: String!
    $from: BigInt!
    $to: BigInt!
  ) {
    communityCampaignMilestoneCompletions(
      where: {
        participantAddress: $address
        createdAt_gte: $from
        createdAt_lt: $to
      }
      first: 1000
      orderBy: createdAt
      orderDirection: asc
    ) {
      id
      createdAt
    }
    forfeitPeriodResolutions(
      where: {
        creatorAddress: $address
        outcome: "success"
        createdAt_gte: $from
        createdAt_lt: $to
      }
      first: 1000
      orderBy: createdAt
      orderDirection: asc
    ) {
      id
      createdAt
    }
  }
`;

function pad2(n: number) {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar YYYY-MM-DD using the browser's getTimezoneOffset() convention. */
export function localDateKey(unixSeconds: number, tzOffsetMinutes: number): string {
  const localMs = unixSeconds * 1000 - tzOffsetMinutes * 60_000;
  const d = new Date(localMs);
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function addDaysIso(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const utc = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const next = new Date(utc);
  return `${next.getUTCFullYear()}-${pad2(next.getUTCMonth() + 1)}-${pad2(next.getUTCDate())}`;
}

/**
 * Fetches campaign + forfeit proof activity for a wallet in [from, to)
 * and buckets counts into Mon–Sun local calendar days.
 */
export async function fetchWeeklyUserActivity(input: {
  address: string;
  weekStart: string;
  fromUnix: number;
  toUnix: number;
  tzOffsetMinutes: number;
}): Promise<WeeklyActivityResult> {
  const address = input.address.toLowerCase();
  const data = await fetchSubgraph<{
    communityCampaignMilestoneCompletions: Array<{ id: string; createdAt: string }>;
    forfeitPeriodResolutions: Array<{ id: string; createdAt: string }>;
  }>(WEEKLY_ACTIVITY_QUERY, {
    address,
    from: String(input.fromUnix),
    to: String(input.toUnix),
  });

  const timestamps: number[] = [];

  for (const row of [
    ...(data.communityCampaignMilestoneCompletions ?? []),
    ...(data.forfeitPeriodResolutions ?? []),
  ]) {
    const ts = Number(row.createdAt);
    if (Number.isFinite(ts) && ts >= input.fromUnix && ts < input.toUnix) {
      timestamps.push(ts);
    }
  }

  const counts = new Map<string, number>();
  for (let i = 0; i < 7; i++) {
    counts.set(addDaysIso(input.weekStart, i), 0);
  }

  for (const ts of timestamps) {
    const key = localDateKey(ts, input.tzOffsetMinutes);
    if (counts.has(key)) {
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const days: ActivityDay[] = DAY_LABELS.map((label, i) => {
    const date = addDaysIso(input.weekStart, i);
    return { date, label, count: counts.get(date) ?? 0 };
  });

  return {
    weekStart: input.weekStart,
    weekEnd: addDaysIso(input.weekStart, 6),
    days,
    total: days.reduce((sum, d) => sum + d.count, 0),
  };
}

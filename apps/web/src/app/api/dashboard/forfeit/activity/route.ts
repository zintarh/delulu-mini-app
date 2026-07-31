import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { readAdminSession } from "@/lib/admin-session";
import { isPlatformAdminRole } from "@/lib/dashboard/authorize";
import {
  CELO_MAINNET_ID,
  DELULU_CHAIN_ID,
  getForfeitMarketAddress,
  getSubgraphUrlForChain,
} from "@/lib/constant";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import {
  TOKEN_DECIMALS_BY_ADDRESS,
  getTokenSymbol,
  weiToTokenAmount,
} from "@/lib/token-amounts";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
/** DestinationType.CommunityPool in ForfeitMarket.sol — both "charity" and "Delulu" UI
 *  choices settle here on-chain; `is_charity_intent` in Supabase is the only place they
 *  split. See ForfeitMarket.sol DestinationType enum. */
const COMMUNITY_POOL_DESTINATION_TYPE = 3;
/** Safety cap on how many CommunityPool resolutions we'll walk to split the pool total
 *  by charity intent — matches the bound the main forfeit analytics route uses. */
const MAX_POOL_RESOLUTIONS_SCANNED = 5000;

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.CELO_RPC_URL ?? "https://forno.celo.org";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

async function requirePlatformAdminSession() {
  const session = await readAdminSession();
  if (!session) {
    return {
      session: null,
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }
  if (!isPlatformAdminRole(session.staffRole)) {
    return {
      session: null,
      error: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }
  return { session, error: null };
}

async function fetchSubgraph<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const url = getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) throw new Error("Subgraph URL not configured");
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    cache: "no-store",
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "Subgraph query failed");
  return json.data as T;
}

type ResolutionRow = {
  id: string;
  commitmentId: string;
  periodIndex: number;
  outcome: string;
  resolver: string;
  creatorAddress: string;
  pointsAwarded: string | null;
  bountyPaid: string | null;
  platformFee: string | null;
  destinationType: number | null;
  destinationAddr: string | null;
  amountToDestination: string | null;
  txHash: string;
  createdAt: string;
  commitment: { token: string };
};

const RESOLUTION_FIELDS = `
  id
  commitmentId
  periodIndex
  outcome
  resolver
  creatorAddress
  pointsAwarded
  bountyPaid
  platformFee
  destinationType
  destinationAddr
  amountToDestination
  txHash
  createdAt
  commitment {
    token
  }
`;

const PAGE_QUERY = `
  query ForfeitActivityPage($first: Int!, $skip: Int!, $where: ForfeitPeriodResolution_filter) {
    forfeitPeriodResolutions(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: desc
      where: $where
    ) {
      ${RESOLUTION_FIELDS}
    }
  }
`;

const POOL_RESOLUTIONS_QUERY = `
  query CommunityPoolResolutions($first: Int!, $skip: Int!) {
    forfeitPeriodResolutions(
      first: $first
      skip: $skip
      orderBy: createdAt
      orderDirection: asc
      where: { outcome: "forfeited", destinationType: ${COMMUNITY_POOL_DESTINATION_TYPE} }
    ) {
      commitmentId
      amountToDestination
      commitment {
        token
      }
    }
  }
`;

function destinationLabel(type: number | null, isCharityIntent: boolean | null): string {
  if (isCharityIntent) return "Charity";
  switch (type) {
    case 0:
      return "Self return";
    case 1:
      return "Charity";
    case 2:
      return "Friend";
    case 3:
      return "Delulu";
    default:
      return "Unknown";
  }
}

async function fetchPoolBalances(): Promise<Record<string, string>> {
  const tokens = Object.keys(TOKEN_DECIMALS_BY_ADDRESS);
  const balances = await Promise.all(
    tokens.map(async (token) => {
      try {
        const balance = await publicClient.readContract({
          address: getForfeitMarketAddress(DELULU_CHAIN_ID),
          abi: FORFEIT_MARKET_ABI,
          functionName: "communityPoolBalance",
          args: [token as `0x${string}`],
        });
        return [token, (balance as bigint).toString()] as const;
      } catch {
        return [token, "0"] as const;
      }
    }),
  );
  return Object.fromEntries(balances);
}

async function fetchCharityShareByToken(): Promise<Record<string, string>> {
  const supabase = getSupabaseAdmin();
  if (!supabase) return {};

  const totals: Record<string, bigint> = {};
  let skip = 0;
  const BATCH = 1000;

  while (skip < MAX_POOL_RESOLUTIONS_SCANNED) {
    const data = await fetchSubgraph<{
      forfeitPeriodResolutions: Array<{
        commitmentId: string;
        amountToDestination: string | null;
        commitment: { token: string };
      }>;
    }>(POOL_RESOLUTIONS_QUERY, { first: BATCH, skip });

    const batch = data.forfeitPeriodResolutions ?? [];
    if (batch.length === 0) break;

    const onChainIds = [...new Set(batch.map((r) => Number(r.commitmentId)))];
    const { data: commitments } = await supabase
      .from("forfeit_commitments")
      .select("on_chain_commitment_id, is_charity_intent")
      .in("on_chain_commitment_id", onChainIds);

    const charityByOnChainId = new Map(
      (commitments ?? []).map((c) => [c.on_chain_commitment_id, Boolean(c.is_charity_intent)]),
    );

    for (const r of batch) {
      if (!charityByOnChainId.get(Number(r.commitmentId))) continue;
      const token = r.commitment.token.toLowerCase();
      const amount = BigInt(r.amountToDestination ?? "0");
      totals[token] = (totals[token] ?? 0n) + amount;
    }

    if (batch.length < BATCH) break;
    skip += BATCH;
  }

  return Object.fromEntries(Object.entries(totals).map(([token, wei]) => [token, wei.toString()]));
}

export async function GET(request: NextRequest) {
  const { error: authError } = await requirePlatformAdminSession();
  if (authError) return authError;

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 500 });
  }

  const { searchParams } = request.nextUrl;
  const outcomeFilter = (searchParams.get("outcome") ?? "").trim();
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);

  const where: Record<string, unknown> = {};
  if (outcomeFilter === "success" || outcomeFilter === "forfeited") {
    where.outcome = outcomeFilter;
  }

  try {
    const [pageResult, poolBalances, charityShareByToken] = await Promise.all([
      fetchSubgraph<{ forfeitPeriodResolutions: ResolutionRow[] }>(PAGE_QUERY, {
        first: PAGE_SIZE + 1,
        skip: (page - 1) * PAGE_SIZE,
        where,
      }),
      fetchPoolBalances(),
      fetchCharityShareByToken(),
    ]);

    const rows = pageResult.forfeitPeriodResolutions ?? [];
    const hasNextPage = rows.length > PAGE_SIZE;
    const pageRows = rows.slice(0, PAGE_SIZE);

    const onChainIds = [...new Set(pageRows.map((r) => Number(r.commitmentId)))];
    const wallets = [...new Set(pageRows.map((r) => r.creatorAddress.toLowerCase()))];

    const [{ data: commitments }, { data: profiles }] = await Promise.all([
      onChainIds.length
        ? supabase
            .from("forfeit_commitments")
            .select("on_chain_commitment_id, title, is_charity_intent")
            .in("on_chain_commitment_id", onChainIds)
        : Promise.resolve({ data: [] as Array<{ on_chain_commitment_id: number; title: string; is_charity_intent: boolean | null }> }),
      wallets.length
        ? supabase.from("profiles").select("address, username").in("address", wallets)
        : Promise.resolve({ data: [] as Array<{ address: string; username: string | null }> }),
    ]);

    const commitmentByOnChainId = new Map(
      (commitments ?? []).map((c) => [c.on_chain_commitment_id, c]),
    );
    const usernameByWallet = new Map(
      (profiles ?? []).map((p) => [String(p.address).toLowerCase(), p.username ?? null]),
    );

    const items = pageRows.map((r) => {
      const commitment = commitmentByOnChainId.get(Number(r.commitmentId));
      const token = r.commitment.token;
      return {
        id: r.id,
        commitmentId: r.commitmentId,
        commitmentTitle: commitment?.title ?? null,
        periodIndex: r.periodIndex,
        outcome: r.outcome === "forfeited" ? "forfeited" : "success",
        creatorWallet: r.creatorAddress,
        creatorUsername: usernameByWallet.get(r.creatorAddress.toLowerCase()) ?? null,
        token,
        tokenSymbol: getTokenSymbol(token),
        amount:
          r.outcome === "forfeited" ? weiToTokenAmount(r.amountToDestination, token) : null,
        platformFee: r.platformFee ? weiToTokenAmount(r.platformFee, token) : null,
        bountyPaid: r.bountyPaid ? weiToTokenAmount(r.bountyPaid, token) : null,
        destinationType: r.destinationType,
        destinationAddr: r.destinationAddr,
        destinationLabel:
          r.outcome === "forfeited"
            ? destinationLabel(r.destinationType, commitment?.is_charity_intent ?? null)
            : null,
        txHash: r.txHash,
        createdAt: new Date(Number(r.createdAt) * 1000).toISOString(),
      };
    });

    const pool = Object.entries(poolBalances).map(([token, balanceWei]) => ({
      token,
      tokenSymbol: getTokenSymbol(token),
      balance: weiToTokenAmount(balanceWei, token),
      charityShare: weiToTokenAmount(charityShareByToken[token] ?? "0", token),
    }));

    return NextResponse.json({
      items,
      page,
      pageSize: PAGE_SIZE,
      hasNextPage,
      pool,
    });
  } catch (err) {
    console.error("[dashboard/forfeit/activity]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to load forfeit activity" },
      { status: 500 },
    );
  }
}

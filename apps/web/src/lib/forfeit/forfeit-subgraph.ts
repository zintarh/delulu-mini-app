import { createPublicClient, http } from "viem";
import { celo } from "viem/chains";
import { FORFEIT_MARKET_ABI } from "@/lib/abi/forfeit-market";
import {
  CELO_MAINNET_ID,
  DELULU_CHAIN_ID,
  getForfeitMarketAddress,
  getSubgraphUrlForChain,
} from "@/lib/constant";

const CELO_RPC =
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.CELO_RPC_URL ??
  "https://forno.celo.org";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(CELO_RPC),
});

async function fetchSubgraph<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const url = getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
  if (!url) throw new Error("Subgraph URL not configured");

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 15 },
  });
  const json = await res.json();
  if (json.errors) throw new Error(json.errors[0]?.message ?? "Subgraph query failed");
  return json.data as T;
}

const BATCH_COMMITMENT_STATE_QUERY = `
  query BatchForfeitCommitmentState($ids: [BigInt!]!) {
    forfeitCommitments(where: { commitmentId_in: $ids }, first: 200) {
      commitmentId
      stakeAmount
      token
      destinationType
      destinationAddr
      cadence
      periodSeconds
      totalPeriods
      currentPeriodIndex
      currentPeriodDeadline
      verifier
      hasPendingVerifierInvite
      active
      cancelled
    }
  }
`;

export interface ForfeitCommitmentOnChainState {
  commitmentId: number;
  stakeAmount: string;
  token: string;
  destinationType: number;
  destinationAddr: string | null;
  cadence: number;
  periodSeconds: string;
  totalPeriods: number;
  currentPeriodIndex: number;
  currentPeriodDeadline: string;
  verifier: string | null;
  hasPendingVerifierInvite: boolean;
  active: boolean;
  cancelled: boolean;
}

async function readCommitmentFromRpc(
  commitmentId: number,
): Promise<ForfeitCommitmentOnChainState | null> {
  try {
    const row = await publicClient.readContract({
      address: getForfeitMarketAddress(DELULU_CHAIN_ID),
      abi: FORFEIT_MARKET_ABI,
      functionName: "commitments",
      args: [BigInt(commitmentId)],
    });
    const [
      _creator,
      token,
      stakeAmount,
      destinationType,
      destinationAddr,
      cadence,
      periodSeconds,
      currentPeriodDeadline,
      currentPeriodIndex,
      totalPeriods,
      verifier,
      active,
      cancelled,
    ] = row as readonly [
      `0x${string}`,
      `0x${string}`,
      bigint,
      number,
      `0x${string}`,
      number,
      bigint,
      bigint,
      number,
      number,
      `0x${string}`,
      boolean,
      boolean,
    ];

    if (!token || stakeAmount === 0n) return null;

    const zero = "0x0000000000000000000000000000000000000000";
    return {
      commitmentId,
      stakeAmount: stakeAmount.toString(),
      token: token.toLowerCase(),
      destinationType: Number(destinationType),
      destinationAddr: destinationAddr?.toLowerCase() ?? null,
      cadence: Number(cadence),
      periodSeconds: periodSeconds.toString(),
      totalPeriods: Number(totalPeriods),
      currentPeriodIndex: Number(currentPeriodIndex),
      currentPeriodDeadline: currentPeriodDeadline.toString(),
      verifier: verifier && verifier.toLowerCase() !== zero ? verifier.toLowerCase() : null,
      hasPendingVerifierInvite: false,
      active: Boolean(active),
      cancelled: Boolean(cancelled),
    };
  } catch {
    return null;
  }
}

/** Batched on-chain state for a set of commitments, keyed by their on_chain_commitment_id. */
export async function fetchBatchForfeitCommitmentState(
  commitmentIds: number[],
): Promise<Map<number, ForfeitCommitmentOnChainState>> {
  const map = new Map<number, ForfeitCommitmentOnChainState>();
  if (commitmentIds.length === 0) return map;

  try {
    const data = await fetchSubgraph<{ forfeitCommitments: ForfeitCommitmentOnChainState[] }>(
      BATCH_COMMITMENT_STATE_QUERY,
      { ids: commitmentIds.map(String) },
    );
    for (const row of data.forfeitCommitments ?? []) {
      map.set(Number(row.commitmentId), {
        ...row,
        commitmentId: Number(row.commitmentId),
        token: String(row.token).toLowerCase(),
        destinationType: Number(row.destinationType),
        destinationAddr: row.destinationAddr
          ? String(row.destinationAddr).toLowerCase()
          : null,
        stakeAmount: String(row.stakeAmount),
      });
    }
  } catch {
    // Fall through to RPC for any missing ids.
  }

  const missing = commitmentIds.filter((id) => !map.has(id));
  if (missing.length === 0) return map;

  const rpcRows = await Promise.all(missing.map((id) => readCommitmentFromRpc(id)));
  for (const row of rpcRows) {
    if (row) map.set(row.commitmentId, row);
  }

  return map;
}

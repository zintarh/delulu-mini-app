import { getSubgraphUrlForChain, CELO_MAINNET_ID } from "@/lib/constant";

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

/** Batched on-chain state for a set of commitments, keyed by their on_chain_commitment_id. */
export async function fetchBatchForfeitCommitmentState(
  commitmentIds: number[],
): Promise<Map<number, ForfeitCommitmentOnChainState>> {
  const map = new Map<number, ForfeitCommitmentOnChainState>();
  if (commitmentIds.length === 0) return map;

  const data = await fetchSubgraph<{ forfeitCommitments: ForfeitCommitmentOnChainState[] }>(
    BATCH_COMMITMENT_STATE_QUERY,
    { ids: commitmentIds.map(String) },
  );

  for (const row of data.forfeitCommitments ?? []) {
    map.set(Number(row.commitmentId), row);
  }
  return map;
}

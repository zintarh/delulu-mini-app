import { createPublicClient, http, type Address } from "viem";
import { celo } from "viem/chains";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { FLOW_ABI, FLOW_COUNCIL, IDENTITY_ABI, IDENTITY_CONTRACT, PROJECT_RECIPIENT } from "@/lib/flow-state";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/**
 * Server-side Flow State reads, batched through multicall: who among our
 * players is face-verified (so can vote) and who already backs Delulu. Used by
 * the nudge engine ("vote for Delulu" to verified non-voters) and the public
 * "N Delulu players have voted" count.
 */
export type FlowVoteState = "voted" | "todo" | "unverified";

const client = () => createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL || "https://forno.celo.org"), batch: { multicall: true } });

export async function flowVoteStates(wallets: string[]): Promise<Map<string, FlowVoteState>> {
  const out = new Map<string, FlowVoteState>();
  const list = [...new Set(wallets.map((w) => w.toLowerCase()))].filter((w) => /^0x[0-9a-f]{40}$/.test(w)) as Address[];
  const c = client();
  for (let i = 0; i < list.length; i += 300) {
    const batch = list.slice(i, i + 300);
    const res = await c.multicall({
      allowFailure: true,
      contracts: batch.flatMap((a) => [
        { address: IDENTITY_CONTRACT, abi: IDENTITY_ABI, functionName: "getWhitelistedRoot", args: [a] } as const,
        { address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "getVotes", args: [a] } as const,
      ]),
    });
    batch.forEach((a, k) => {
      const root = res[2 * k];
      const votes = res[2 * k + 1];
      // Unreadable → leave them out rather than ask someone who already voted.
      if (root.status !== "success" || votes.status !== "success") return;
      const voted = (votes.result as readonly { recipient: Address; amount: bigint }[]).some((v) => v.recipient.toLowerCase() === PROJECT_RECIPIENT && v.amount > 0n);
      const verified = !/^0x0{40}$/i.test(root.result as string);
      out.set(a, voted ? "voted" : verified ? "todo" : "unverified");
    });
  }
  return out;
}

export type FlowTally = { voters: number; canVote: number; votes: number; at: string };
let cached: { tally: FlowTally; at: number } | null = null;
const CACHE_MS = 10 * 60_000;

/** "N Delulu players have voted": our players backing Delulu, plus Delulu's total council votes. Cached 10 min. */
export async function flowTally(admin: Admin): Promise<FlowTally> {
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.tally;
  const wallets: string[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("profiles").select("address").range(from, from + 999);
    if (error) throw error;
    wallets.push(...(data ?? []).map((p) => String(p.address)));
    if (!data || data.length < 1000) break;
  }
  const [states, recipient] = await Promise.all([
    flowVoteStates(wallets),
    client().readContract({ address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "getRecipient", args: [PROJECT_RECIPIENT] }),
  ]);
  const all = [...states.values()];
  const tally: FlowTally = {
    voters: all.filter((s) => s === "voted").length,
    canVote: all.filter((s) => s !== "unverified").length,
    votes: Number(recipient.votes),
    at: new Date().toISOString(),
  };
  cached = { tally, at: Date.now() };
  return tally;
}

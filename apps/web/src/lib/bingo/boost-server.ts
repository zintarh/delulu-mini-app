import { createPublicClient, http, parseEventLogs, formatUnits, type TransactionReceipt } from "viem";
import { celo } from "viem/chains";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { getForfeitMarketAddress } from "@/lib/constant";
import { BOOST_ABI, type BoostDay } from "@/lib/bingo/boost";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;


const client = createPublicClient({
  chain: celo,
  transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? process.env.CELO_RPC_URL ?? "https://forno.celo.org"),
});

/** The wallet's RPC can see a tx before ours does: poll a little. */
async function receiptOf(hash: `0x${string}`): Promise<TransactionReceipt | null> {
  for (let i = 0; i < 10; i++) {
    const r = await client.getTransactionReceipt({ hash }).catch(() => null);
    if (r) return r;
    await new Promise((res) => setTimeout(res, 1500 + i * 500));
  }
  return null;
}

export type VerifiedBoost = { commitmentId: number; slot: number; creator: string; amount: number; logIndex: number };

/** The CommitmentBoosted events in a tx, from our ForfeitMarket only, in whole G$. */
export async function boostsInTx(txHash: `0x${string}`): Promise<VerifiedBoost[] | "pending" | "failed"> {
  const receipt = await receiptOf(txHash);
  if (!receipt) return "pending";
  if (receipt.status !== "success") return "failed";
  const market = getForfeitMarketAddress().toLowerCase();
  const logs = parseEventLogs({ abi: BOOST_ABI, eventName: "CommitmentBoosted", logs: receipt.logs }).filter((l) => l.address.toLowerCase() === market);
  return logs.map((l) => ({
    commitmentId: Number(l.args.commitmentId),
    slot: Number(l.args.periodIndex),
    creator: l.args.creator.toLowerCase(),
    amount: Number(formatUnits(l.args.amount, 18)),
    logIndex: Number(l.logIndex),
  }));
}

/** A card's recorded boosts. Empty (never an error) before the migration runs. */
export async function loadBoosts(admin: Admin, attemptId: string): Promise<BoostDay[]> {
  const { data, error } = await admin.from("bingo_boosts").select("slot_index, amount").eq("attempt_id", attemptId);
  if (error) return [];
  return (data ?? []).map((b) => ({ slot: Number(b.slot_index), amount: Number(b.amount) }));
}

/** Players who boosted today (Lagos day) — social proof on the boost card. */
export async function boostersToday(admin: Admin): Promise<number> {
  const lagosMidnight = new Date(`${new Date(Date.now() + 3_600_000).toISOString().slice(0, 10)}T00:00:00+01:00`).toISOString();
  const { data, error } = await admin.from("bingo_boosts").select("wallet").gte("created_at", lagosMidnight).limit(5000);
  if (error) return 0;
  return new Set((data ?? []).map((r) => String(r.wallet))).size;
}

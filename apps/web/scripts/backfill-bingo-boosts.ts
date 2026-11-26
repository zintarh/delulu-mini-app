/**
 * Records Daily Boost top-ups that landed on-chain but never reached
 * bingo_boosts (e.g. before docs/migrations/20261125_bingo_boosts.sql ran).
 * Reads ForfeitMarket CommitmentBoosted events, matches each to its Bingo card
 * by forfeit_commitment_id + wallet, and inserts what's missing. Safe to rerun
 * (tx_hash + log_index is unique).
 *
 * Run (from apps/web):  npx tsx scripts/backfill-bingo-boosts.ts [--blocks 400000] [--dry]
 */
import { config } from "dotenv";
config({ path: ".env.local" });
import { createPublicClient, http, formatUnits, parseAbiItem } from "viem";
import { celo } from "viem/chains";
import { createClient } from "@supabase/supabase-js";

const MARKET = "0x5548eC3Aa02dCbcE85Cdc6Ad37d61613019D92f8" as const;
// Same event as lib/bingo/boost.ts BOOST_ABI.
const EVENT = parseAbiItem(
  "event CommitmentBoosted(uint256 indexed commitmentId, uint32 indexed periodIndex, address indexed creator, uint256 amount, uint256 newStakeAmount)",
);
const arg = (k: string) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const DRY = process.argv.includes("--dry");
const BLOCKS = BigInt(arg("--blocks") ?? "400000");
const CHUNK = 2_000n;

(async () => {
  const admin = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const client = createPublicClient({ chain: celo, transport: http(process.env.CELO_RPC_URL || "https://forno.celo.org") });

  const probe = await admin.from("bingo_boosts").select("id").limit(1);
  if (probe.error) throw new Error(`bingo_boosts unavailable (run docs/migrations/20261125_bingo_boosts.sql first): ${probe.error.message}`);

  const head = await client.getBlockNumber();
  const logs = [];
  for (let b = head - BLOCKS; b <= head; b += CHUNK) {
    const to = b + CHUNK - 1n > head ? head : b + CHUNK - 1n;
    logs.push(...(await client.getLogs({ address: MARKET, event: EVENT, fromBlock: b, toBlock: to })));
  }

  const { data: existing } = await admin.from("bingo_boosts").select("tx_hash, log_index");
  const have = new Set((existing ?? []).map((r) => `${r.tx_hash}:${r.log_index}`));
  const missing = logs.filter((l) => !have.has(`${l.transactionHash!.toLowerCase()}:${l.logIndex}`));

  const ids = [...new Set(missing.map((l) => Number(l.args.commitmentId)))];
  const { data: attempts } = ids.length
    ? await admin.from("bingo_attempts").select("id, wallet, forfeit_commitment_id").in("forfeit_commitment_id", ids)
    : { data: [] as { id: string; wallet: string; forfeit_commitment_id: number }[] };
  const byCommitment = new Map((attempts ?? []).map((a) => [Number(a.forfeit_commitment_id), a]));

  const rows = [];
  const unmatched = [];
  for (const l of missing) {
    const a = byCommitment.get(Number(l.args.commitmentId));
    const wallet = l.args.creator!.toLowerCase();
    if (!a || String(a.wallet).toLowerCase() !== wallet) {
      unmatched.push(`${l.transactionHash} commitment ${l.args.commitmentId}`);
      continue;
    }
    rows.push({
      attempt_id: a.id,
      wallet,
      commitment_id: Number(l.args.commitmentId),
      slot_index: Number(l.args.periodIndex),
      amount: Number(formatUnits(l.args.amount!, 18)),
      tx_hash: l.transactionHash!.toLowerCase(),
      log_index: Number(l.logIndex),
    });
  }

  const total = rows.reduce((n, r) => n + r.amount, 0);
  console.log(`on-chain boosts: ${logs.length} · already recorded: ${logs.length - missing.length} · to record: ${rows.length} (${total} G$) · not a Bingo card: ${unmatched.length}`);
  for (const u of unmatched) console.log("  not a Bingo card:", u);
  if (DRY || !rows.length) return;
  const { error } = await admin.from("bingo_boosts").upsert(rows, { onConflict: "tx_hash,log_index", ignoreDuplicates: true });
  if (error) throw new Error(error.message);
  console.log(`recorded ${rows.length} top-ups.`);
})();

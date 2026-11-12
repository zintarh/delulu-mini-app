import type { SupabaseClient } from "@supabase/supabase-js";
import { createPublicClient, erc20Abi, http, isAddress, parseAbiItem } from "viem";
import { celo } from "viem/chains";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { notifyManyRecipients } from "@/lib/push/notify-recipients";
import { createNotification } from "@/lib/notifications";
import { resolveUsernameForAddress } from "@/lib/resolve-username";
import {
  SUPPORT_BLOCK_MESSAGES,
  milestoneLabel,
  parseSupportAmount,
  reachedSupportMilestones,
  weiToWhole,
} from "@/lib/support/rules";
import { matchTransfer } from "@/lib/support/transfer-match";
import {
  SUPPORT_COMMITMENT_SELECT,
  eligibilityFor,
  loadChainState,
  type SupportCommitmentRow,
} from "@/lib/support/server";

const RPC =
  process.env.CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_CELO_RPC_URL ??
  process.env.NEXT_PUBLIC_RPC_URL ??
  "https://forno.celo.org";
const client = createPublicClient({ chain: celo, transport: http(RPC) });

export const SUPPORT_TOKEN = GOODDOLLAR_ADDRESSES.mainnet.toLowerCase() as `0x${string}`;
const TRANSFER_EVENT = parseAbiItem("event Transfer(address indexed from, address indexed to, uint256 value)");

/** A submitted tx with no receipt after this long is treated as dropped (if the node doesn't know it). */
const DROPPED_AFTER_MS = 2 * 3600_000;
/** Pending (no hash yet) records older than this get an on-chain search for a lost transfer. */
const ORPHAN_SEARCH_AFTER_MS = 3 * 60_000;
/** Pending records with no transfer after this long expire. */
const PENDING_EXPIRES_MS = 24 * 3600_000;

export const SUPPORT_SELECT =
  "id, commitment_id, on_chain_commitment_id, supporter_wallet, recipient_wallet, token, amount_wei::text, client_request_id, tx_hash, status, attempts, last_error, block_number, submitted_at, confirmed_at, failed_at, created_at";

export type SupportStatus = "pending" | "submitted" | "confirmed" | "failed" | "expired";

export type SupportRow = {
  id: string;
  commitment_id: string;
  on_chain_commitment_id: number;
  supporter_wallet: string;
  recipient_wallet: string;
  token: string;
  amount_wei: string;
  client_request_id: string;
  tx_hash: string | null;
  status: SupportStatus;
  attempts: number;
  last_error: string | null;
  block_number: number | null;
  submitted_at: string | null;
  confirmed_at: string | null;
  failed_at: string | null;
  created_at: string;
};

export class SupportError extends Error {
  constructor(
    message: string,
    public status: number,
    public retryable = false,
  ) {
    super(message);
  }
}

/** What the supporter's client needs — the recipient wallet is required to sign the transfer. */
export function intentDto(row: SupportRow) {
  return {
    id: row.id,
    status: row.status,
    to: row.recipient_wallet,
    token: row.token,
    amountWei: row.amount_wei,
    amountG: weiToWhole(row.amount_wei),
    txHash: row.tx_hash,
    error: row.status === "failed" ? row.last_error : null,
  };
}
export type SupportIntentDto = ReturnType<typeof intentDto>;

async function loadSupport(admin: SupabaseClient, id: string): Promise<SupportRow | null> {
  const { data } = await admin.from("delulu_supports").select(SUPPORT_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as SupportRow) ?? null;
}

// ---------------------------------------------------------------------------
// 1. Intent: validate everything we can before the wallet signs
// ---------------------------------------------------------------------------
export async function createSupportIntent(
  admin: SupabaseClient,
  params: { supporter: string; onChainId: number; amount: string; clientRequestId: string },
): Promise<SupportRow> {
  const supporter = params.supporter.toLowerCase();
  if (!/^[A-Za-z0-9-]{8,64}$/.test(params.clientRequestId)) {
    throw new SupportError("Invalid request id", 400);
  }
  const amount = parseSupportAmount(params.amount);
  if (!amount.ok) throw new SupportError(amount.error, 400);

  // Retried create (double tap / network retry) → same record.
  const { data: existing } = await admin
    .from("delulu_supports")
    .select(SUPPORT_SELECT)
    .eq("supporter_wallet", supporter)
    .eq("client_request_id", params.clientRequestId)
    .maybeSingle();
  if (existing) return existing as unknown as SupportRow;

  const { data: c } = await admin
    .from("forfeit_commitments")
    .select(SUPPORT_COMMITMENT_SELECT)
    .eq("on_chain_commitment_id", params.onChainId)
    .maybeSingle();
  const row = c as unknown as SupportCommitmentRow | null;
  if (!row || row.is_private !== false) throw new SupportError(SUPPORT_BLOCK_MESSAGES.private, 404);

  const chain = (await loadChainState([params.onChainId])).get(params.onChainId);
  if (!chain) throw new SupportError("Couldn't reach the chain — try again.", 503, true);
  const eligible = eligibilityFor(row, chain, supporter);
  if (!eligible.ok) throw new SupportError(SUPPORT_BLOCK_MESSAGES[eligible.reason], 409);

  const recipient = row.creator_wallet.toLowerCase();
  if (!isAddress(recipient) || /^0x0{40}$/.test(recipient)) {
    throw new SupportError("This Delulu can't receive support.", 409);
  }

  const balance = await client
    .readContract({ address: SUPPORT_TOKEN, abi: erc20Abi, functionName: "balanceOf", args: [supporter as `0x${string}`] })
    .catch(() => null);
  if (balance != null && balance < amount.wei) throw new SupportError("Not enough G$ for this amount.", 400);

  const insert = await admin
    .from("delulu_supports")
    .insert({
      commitment_id: row.id,
      on_chain_commitment_id: params.onChainId,
      supporter_wallet: supporter,
      recipient_wallet: recipient,
      token: SUPPORT_TOKEN,
      amount_wei: amount.wei.toString(),
      client_request_id: params.clientRequestId,
    })
    .select(SUPPORT_SELECT)
    .single();
  if (insert.error) {
    if (/duplicate|unique/i.test(insert.error.message)) {
      const { data: raced } = await admin
        .from("delulu_supports")
        .select(SUPPORT_SELECT)
        .eq("supporter_wallet", supporter)
        .eq("client_request_id", params.clientRequestId)
        .maybeSingle();
      if (raced) return raced as unknown as SupportRow;
    }
    throw new SupportError(insert.error.message, 500, true);
  }
  return insert.data as unknown as SupportRow;
}

// ---------------------------------------------------------------------------
// 2. Attach the broadcast tx hash (never trusted as success on its own)
// ---------------------------------------------------------------------------
export async function attachSupportTx(
  admin: SupabaseClient,
  params: { supporter: string; supportId: string; txHash: string },
): Promise<SupportRow> {
  const txHash = params.txHash.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(txHash)) throw new SupportError("Invalid transaction hash", 400);
  const row = await loadSupport(admin, params.supportId);
  if (!row || row.supporter_wallet !== params.supporter.toLowerCase()) throw new SupportError("Not found", 404);

  if (row.tx_hash) {
    if (row.tx_hash.toLowerCase() === txHash) return row; // retried submit
    throw new SupportError("This support already has a transaction.", 409);
  }
  if (row.status !== "pending" && row.status !== "expired") {
    throw new SupportError("This support can't take a transaction anymore.", 409);
  }

  const { data, error } = await admin
    .from("delulu_supports")
    .update({ tx_hash: txHash, status: "submitted", submitted_at: new Date().toISOString(), last_error: null })
    .eq("id", row.id)
    .is("tx_hash", null)
    .select(SUPPORT_SELECT)
    .maybeSingle();
  if (error) {
    if (/duplicate|unique/i.test(error.message)) {
      throw new SupportError("This transaction is already recorded.", 409);
    }
    throw new SupportError(error.message, 500, true);
  }
  // Lost a race with another submit for this row — return whatever won.
  return (data as unknown as SupportRow) ?? ((await loadSupport(admin, row.id)) as SupportRow);
}

// ---------------------------------------------------------------------------
// 3. Settle from the receipt — the only path to "confirmed"
// ---------------------------------------------------------------------------
async function receiptFor(hash: `0x${string}`) {
  try {
    return await client.getTransactionReceipt({ hash });
  } catch {
    return null; // not mined / not indexed yet
  }
}

async function markFailed(admin: SupabaseClient, row: SupportRow, reason: string): Promise<SupportRow> {
  const { data } = await admin
    .from("delulu_supports")
    .update({ status: "failed", last_error: reason, failed_at: new Date().toISOString() })
    .eq("id", row.id)
    .eq("status", "submitted")
    .select(SUPPORT_SELECT)
    .maybeSingle();
  return (data as unknown as SupportRow) ?? ((await loadSupport(admin, row.id)) as SupportRow);
}

export async function settleSupport(
  admin: SupabaseClient,
  supportId: string,
  opts: { waitMs?: number } = {},
): Promise<SupportRow | null> {
  let row = await loadSupport(admin, supportId);
  if (!row || row.status !== "submitted" || !row.tx_hash) return row;

  const deadline = Date.now() + (opts.waitMs ?? 0);
  let receipt = await receiptFor(row.tx_hash as `0x${string}`);
  while (!receipt && Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 1_500));
    receipt = await receiptFor(row.tx_hash as `0x${string}`);
  }

  if (!receipt) {
    const age = Date.now() - Date.parse(row.submitted_at ?? row.created_at);
    if (age > DROPPED_AFTER_MS) {
      const known = await client.getTransaction({ hash: row.tx_hash as `0x${string}` }).catch(() => null);
      if (!known) return markFailed(admin, row, "Transaction was dropped by the network.");
    }
    await admin.from("delulu_supports").update({ attempts: row.attempts + 1 }).eq("id", row.id);
    return row;
  }

  if (receipt.status !== "success") return markFailed(admin, row, "Transaction failed on-chain.");

  const match = matchTransfer(
    receipt.logs.map((l) => ({ ...l, topics: l.topics as readonly string[] })),
    {
      token: row.token,
      from: row.supporter_wallet,
      to: row.recipient_wallet,
      amountWei: BigInt(row.amount_wei),
    },
  );
  if (!match) return markFailed(admin, row, "Transaction doesn't match this support.");

  const { data: won } = await admin
    .from("delulu_supports")
    .update({
      status: "confirmed",
      amount_wei: match.valueWei.toString(),
      block_number: Number(receipt.blockNumber),
      confirmed_at: new Date().toISOString(),
      last_error: null,
    })
    .eq("id", row.id)
    .eq("status", "submitted")
    .select(SUPPORT_SELECT)
    .maybeSingle();

  if (!won) return loadSupport(admin, row.id); // someone else confirmed it first
  row = won as unknown as SupportRow;
  await afterConfirmed(admin, row).catch((e) => console.error("[support] after-confirm failed", e));
  return row;
}

// ---------------------------------------------------------------------------
// 4. Side effects — run exactly once, by whoever won the confirm update
// ---------------------------------------------------------------------------
async function afterConfirmed(admin: SupabaseClient, row: SupportRow) {
  const { data: totals } = await admin.rpc("refresh_delulu_support_totals", { p_commitment_id: row.commitment_id });
  const { data: c } = await admin
    .from("forfeit_commitments")
    .select("title")
    .eq("id", row.commitment_id)
    .maybeSingle();
  const title = c?.title ?? "your Delulu";
  const [supporterName, creatorName] = await Promise.all([
    resolveUsernameForAddress(admin, row.supporter_wallet),
    resolveUsernameForAddress(admin, row.recipient_wallet),
  ]);
  const amount = `${weiToWhole(row.amount_wei).toLocaleString("en-US")} G$`;
  const url = `/support/${row.on_chain_commitment_id}`;
  const who = supporterName ? `@${supporterName}` : "Someone";

  await notifyManyRecipients(admin, [row.recipient_wallet], {
    title: `${who} supported your Delulu`,
    body: `${amount} for "${title}"`,
    url,
    type: "delulu_supported",
    message: `**${who}** sent you **${amount}** for **${title}**`,
    actorAddress: row.supporter_wallet,
    eventKeyFor: (a) => `delulu_supported:${row.id}:${a}`,
  }).catch((e) => console.error("[support] creator notify failed", e));

  await createNotification({
    recipientAddress: row.supporter_wallet,
    type: "support_sent",
    message: `You sent **${amount}** to **${creatorName ? `@${creatorName}` : "a Delulu"}** for **${title}**`,
    actionUrl: url,
    actorAddress: row.recipient_wallet,
  }).catch((e) => console.error("[support] supporter notify failed", e));

  const t = totals as { total_wei?: string; supporter_count?: number } | null;
  if (!t?.total_wei) return;
  const keys = reachedSupportMilestones(BigInt(t.total_wei), t.supporter_count ?? 0);
  if (keys.length === 0) return;
  const { data: fresh } = await admin
    .from("delulu_support_milestones")
    .upsert(
      keys.map((milestone) => ({ commitment_id: row.commitment_id, milestone })),
      { onConflict: "commitment_id,milestone", ignoreDuplicates: true },
    )
    .select("milestone");
  // Several thresholds crossed at once → one notification for the biggest.
  const newest = (fresh ?? []).map((m) => m.milestone as string);
  if (newest.length === 0) return;
  const label = milestoneLabel(newest[newest.length - 1]!);
  await notifyManyRecipients(admin, [row.recipient_wallet], {
    title: "Support milestone!",
    body: `"${title}" reached ${label}`,
    url,
    type: "support_milestone",
    message: `**${title}** reached **${label}**`,
    eventKeyFor: (a) => `support_milestone:${row.commitment_id}:${newest.join("+")}:${a}`,
  }).catch((e) => console.error("[support] milestone notify failed", e));
}

// ---------------------------------------------------------------------------
// 5. Reconciler (cron): settle stragglers, recover lost hashes, expire leftovers
// ---------------------------------------------------------------------------
async function findOrphanTransfer(admin: SupabaseClient, row: SupportRow): Promise<string | null> {
  const latest = await client.getBlockNumber();
  const ageSec = BigInt(Math.ceil((Date.now() - Date.parse(row.created_at)) / 1000));
  // Celo ~1s blocks; small margin before the intent was created.
  const span = ageSec + 600n > 300_000n ? 300_000n : ageSec + 600n;
  const logs = await client.getLogs({
    address: row.token as `0x${string}`,
    event: TRANSFER_EVENT,
    args: { from: row.supporter_wallet as `0x${string}`, to: row.recipient_wallet as `0x${string}` },
    fromBlock: latest > span ? latest - span : 0n,
    toBlock: latest,
  });
  const candidates = logs
    .map((l) => ({ ...l, topics: l.topics as readonly string[] }))
    .filter((l) => matchTransfer([l], { token: row.token, from: row.supporter_wallet, to: row.recipient_wallet, amountWei: BigInt(row.amount_wei) }));
  if (candidates.length === 0) return null;
  const hashes = candidates.map((l) => l.transactionHash!.toLowerCase());
  const { data: used } = await admin.from("delulu_supports").select("tx_hash").in("tx_hash", hashes);
  const taken = new Set((used ?? []).map((u) => String(u.tx_hash).toLowerCase()));
  return hashes.find((h) => !taken.has(h)) ?? null;
}

export async function reconcileSupports(
  admin: SupabaseClient,
  opts: { deadlineMs?: number } = {},
): Promise<{ settled: number; confirmed: number; failed: number; recovered: number; expired: number }> {
  const stop = Date.now() + (opts.deadlineMs ?? 30_000);
  const out = { settled: 0, confirmed: 0, failed: 0, recovered: 0, expired: 0 };

  const { data: submitted } = await admin
    .from("delulu_supports")
    .select("id")
    .eq("status", "submitted")
    .order("submitted_at", { ascending: true })
    .limit(50);
  for (const { id } of submitted ?? []) {
    if (Date.now() > stop) return out;
    const r = await settleSupport(admin, id);
    out.settled++;
    if (r?.status === "confirmed") out.confirmed++;
    if (r?.status === "failed") out.failed++;
  }

  const now = Date.now();
  const { data: pending } = await admin
    .from("delulu_supports")
    .select(SUPPORT_SELECT)
    .eq("status", "pending")
    .is("tx_hash", null)
    .lt("created_at", new Date(now - ORPHAN_SEARCH_AFTER_MS).toISOString())
    .order("created_at", { ascending: true })
    .limit(30);
  for (const raw of pending ?? []) {
    if (Date.now() > stop) return out;
    const row = raw as unknown as SupportRow;
    const hash = await findOrphanTransfer(admin, row).catch(() => null);
    if (hash) {
      const attached = await attachSupportTx(admin, {
        supporter: row.supporter_wallet,
        supportId: row.id,
        txHash: hash,
      }).catch(() => null);
      if (attached) {
        out.recovered++;
        const r = await settleSupport(admin, row.id);
        if (r?.status === "confirmed") out.confirmed++;
      }
      continue;
    }
    if (now - Date.parse(row.created_at) > PENDING_EXPIRES_MS) {
      await admin
        .from("delulu_supports")
        .update({ status: "expired", last_error: "No transfer was sent." })
        .eq("id", row.id)
        .eq("status", "pending")
        .is("tx_hash", null);
      out.expired++;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 6. "A Delulu you supported was completed" — fan out to its supporters
// ---------------------------------------------------------------------------
/**
 * Called when a Delulu completes. Notifies everyone with confirmed support for
 * it, once each (push_events_sent dedupes by event key), whatever its current
 * visibility — they already backed it.
 */
export async function notifySupportersOfCompletion(admin: SupabaseClient, commitmentId: string): Promise<void> {
  const { data: rows } = await admin
    .from("delulu_supports")
    .select("supporter_wallet, on_chain_commitment_id")
    .eq("commitment_id", commitmentId)
    .eq("status", "confirmed")
    .limit(2000);
  if (!rows || rows.length === 0) return;
  const { data: c } = await admin
    .from("forfeit_commitments")
    .select("creator_wallet, title")
    .eq("id", commitmentId)
    .maybeSingle();
  if (!c) return;
  const creator = await resolveUsernameForAddress(admin, c.creator_wallet);
  const who = creator ? `@${creator}` : "Someone you support";
  const title = c.title ?? "their Delulu";
  await notifyManyRecipients(
    admin,
    rows.map((r) => r.supporter_wallet),
    {
      title: `${who} did it!`,
      body: `They completed "${title}"`,
      url: `/support/${rows[0]!.on_chain_commitment_id}`,
      type: "supported_delulu_completed",
      message: `**${who}** completed **${title}**, a Delulu you supported`,
      actorAddress: c.creator_wallet,
      eventKeyFor: (a) => `supported_delulu_completed:${commitmentId}:${a}`,
    },
  );
}

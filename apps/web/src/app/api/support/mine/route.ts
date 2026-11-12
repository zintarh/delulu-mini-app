import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { weiToWhole } from "@/lib/support/rules";
import { loadPublicProfiles } from "@/lib/support/server";
import { capitalizeFirst } from "@/lib/utils";

export const dynamic = "force-dynamic";

const LIMIT = 50;

type Row = {
  id: string;
  commitment_id: string;
  on_chain_commitment_id: number;
  supporter_wallet: string;
  recipient_wallet: string;
  amount_wei: string;
  status: string;
  tx_hash: string | null;
  last_error: string | null;
  created_at: string;
  confirmed_at: string | null;
};

const SELECT =
  "id, commitment_id, on_chain_commitment_id, supporter_wallet, recipient_wallet, amount_wei::text, status, tx_hash, last_error, created_at, confirmed_at";

export type MySupportDto = {
  sent: {
    totalG: number;
    delulus: number;
    items: SupportTxItem[];
  };
  received: {
    totalG: number;
    supporters: number;
    items: SupportTxItem[];
  };
  myDelulus: { id: number; title: string; isPublic: boolean; totalG: number; supporters: number }[];
};

export type SupportTxItem = {
  id: string;
  deluluId: number;
  deluluTitle: string;
  /** The other party: recipient for "sent", supporter for "received". */
  person: { username: string | null; pfpUrl: string | null };
  amountG: number;
  status: "submitted" | "confirmed" | "failed";
  txHash: string | null;
  error: string | null;
  at: string;
};

/**
 * Signed-in user's support activity: what they sent (with status + tx), what
 * their Delulus received (confirmed only), and per-Delulu totals.
 */
export async function GET(request: NextRequest) {
  const wallet = getAuthenticatedWallet(request);
  if (!wallet) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const [sentRes, receivedRes, sentTotalsRes, receivedTotalsRes, mineRes] = await Promise.all([
    // Pending (never signed) and expired rows are noise — nothing moved.
    admin
      .from("delulu_supports")
      .select(SELECT)
      .eq("supporter_wallet", wallet)
      .in("status", ["submitted", "confirmed", "failed"])
      .order("created_at", { ascending: false })
      .limit(LIMIT),
    admin
      .from("delulu_supports")
      .select(SELECT)
      .eq("recipient_wallet", wallet)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(LIMIT),
    admin
      .from("delulu_supports")
      .select("commitment_id, amount_wei::text")
      .eq("supporter_wallet", wallet)
      .eq("status", "confirmed")
      .limit(5000),
    admin
      .from("delulu_supports")
      .select("supporter_wallet, amount_wei::text")
      .eq("recipient_wallet", wallet)
      .eq("status", "confirmed")
      .limit(5000),
    admin
      .from("forfeit_commitments")
      .select("on_chain_commitment_id, title, is_private, support_total_wei::text, supporter_count")
      .ilike("creator_wallet", wallet)
      .or("is_private.eq.false,supporter_count.gt.0")
      .not("on_chain_commitment_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);
  const err = sentRes.error ?? receivedRes.error ?? mineRes.error;
  if (err) return NextResponse.json({ error: err.message }, { status: 500 });

  const sent = (sentRes.data ?? []) as unknown as Row[];
  const received = (receivedRes.data ?? []) as unknown as Row[];
  const commitmentIds = [...new Set([...sent, ...received].map((r) => r.commitment_id))];
  const [titlesRes, profiles] = await Promise.all([
    commitmentIds.length
      ? admin.from("forfeit_commitments").select("id, title").in("id", commitmentIds)
      : Promise.resolve({ data: [] as { id: string; title: string }[] }),
    loadPublicProfiles(admin, [...sent.map((r) => r.recipient_wallet), ...received.map((r) => r.supporter_wallet)]),
  ]);
  const titleById = new Map((titlesRes.data ?? []).map((t) => [t.id, capitalizeFirst(t.title ?? "")]));
  const none = { username: null, pfpUrl: null };

  const toItem = (r: Row, other: string): SupportTxItem => ({
    id: r.id,
    deluluId: Number(r.on_chain_commitment_id),
    deluluTitle: titleById.get(r.commitment_id) ?? "Delulu",
    person: profiles.get(other.toLowerCase()) ?? none,
    amountG: weiToWhole(r.amount_wei),
    status: r.status as SupportTxItem["status"],
    txHash: r.tx_hash,
    error: r.status === "failed" ? r.last_error : null,
    at: r.confirmed_at ?? r.created_at,
  });

  const sum = (rows: { amount_wei: string }[]) => rows.reduce((a, r) => a + BigInt(r.amount_wei), 0n);
  const sentTotals = (sentTotalsRes.data ?? []) as { commitment_id: string; amount_wei: string }[];
  const receivedTotals = (receivedTotalsRes.data ?? []) as { supporter_wallet: string; amount_wei: string }[];

  return NextResponse.json({
    sent: {
      totalG: weiToWhole(sum(sentTotals)),
      delulus: new Set(sentTotals.map((r) => r.commitment_id)).size,
      items: sent.map((r) => toItem(r, r.recipient_wallet)),
    },
    received: {
      totalG: weiToWhole(sum(receivedTotals)),
      supporters: new Set(receivedTotals.map((r) => r.supporter_wallet)).size,
      items: received.map((r) => toItem(r, r.supporter_wallet)),
    },
    myDelulus: (mineRes.data ?? []).map((c) => ({
      id: Number(c.on_chain_commitment_id),
      title: capitalizeFirst(c.title ?? ""),
      isPublic: c.is_private === false,
      totalG: weiToWhole(c.support_total_wei as string),
      supporters: c.supporter_count ?? 0,
    })),
  } satisfies MySupportDto);
}

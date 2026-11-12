import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { weiToWhole } from "@/lib/support/rules";
import { loadPublicProfiles, type PublicProfile } from "@/lib/support/server";

export const dynamic = "force-dynamic";

const WEEK_MS = 7 * 86_400_000;

export type SupportPulseDto = {
  totalG: number;
  backedThisWeek: number;
  faces: PublicProfile[];
  recent: { id: string; from: PublicProfile; to: PublicProfile; amountG: number; at: string; deluluId: number }[];
};

/**
 * Community pulse for the Support header: all-time support sent, people who
 * backed someone this week, and the latest confirmed supports. Confirmed rows
 * only; usernames and avatars only — no wallets.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const [allRes, recentRes] = await Promise.all([
    admin
      .from("delulu_supports")
      .select("supporter_wallet, amount_wei::text, confirmed_at")
      .eq("status", "confirmed")
      .limit(20_000),
    admin
      .from("delulu_supports")
      .select("id, supporter_wallet, recipient_wallet, amount_wei::text, confirmed_at, on_chain_commitment_id, commitment_id")
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(12),
  ]);
  if (allRes.error) return NextResponse.json({ error: allRes.error.message }, { status: 500 });

  const rows = (allRes.data ?? []) as { supporter_wallet: string; amount_wei: string; confirmed_at: string }[];
  const total = rows.reduce((a, r) => a + BigInt(r.amount_wei), 0n);
  const since = Date.now() - WEEK_MS;
  const weekly = new Set(rows.filter((r) => Date.parse(r.confirmed_at) >= since).map((r) => r.supporter_wallet));

  const recentRaw = (recentRes.data ?? []) as {
    id: string;
    supporter_wallet: string;
    recipient_wallet: string;
    amount_wei: string;
    confirmed_at: string;
    on_chain_commitment_id: number;
    commitment_id: string;
  }[];
  // Ticker only links to goals that are still public.
  const ids = [...new Set(recentRaw.map((r) => r.commitment_id))];
  const { data: pub } = ids.length
    ? await admin.from("forfeit_commitments").select("id").in("id", ids).eq("is_private", false)
    : { data: [] as { id: string }[] };
  const publicIds = new Set((pub ?? []).map((p) => p.id));
  const recent = recentRaw.filter((r) => publicIds.has(r.commitment_id));

  const profiles = await loadPublicProfiles(admin, recent.flatMap((r) => [r.supporter_wallet, r.recipient_wallet]));
  const none: PublicProfile = { username: null, pfpUrl: null };
  const faceWallets = [...new Set(recent.map((r) => r.supporter_wallet.toLowerCase()))].slice(0, 5);

  return NextResponse.json(
    {
      totalG: weiToWhole(total),
      backedThisWeek: weekly.size,
      faces: faceWallets.map((w) => profiles.get(w) ?? none),
      recent: recent.map((r) => ({
        id: r.id,
        from: profiles.get(r.supporter_wallet.toLowerCase()) ?? none,
        to: profiles.get(r.recipient_wallet.toLowerCase()) ?? none,
        amountG: weiToWhole(r.amount_wei),
        at: r.confirmed_at,
        deluluId: Number(r.on_chain_commitment_id),
      })),
    } satisfies SupportPulseDto,
    { headers: { "Cache-Control": "public, s-maxage=30, stale-while-revalidate=120" } },
  );
}

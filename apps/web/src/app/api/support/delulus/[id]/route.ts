import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import { weiToWhole } from "@/lib/support/rules";
import {
  SUPPORT_COMMITMENT_SELECT,
  loadChainState,
  loadKeptPeriods,
  loadPublicProfiles,
  loadSupporterFaces,
  toPublicDelulu,
  type SupportCommitmentRow,
} from "@/lib/support/server";

export const dynamic = "force-dynamic";

const RECENT_LIMIT = 6;

/** Public Delulu details. Private (or never-confirmed) → 404, same as missing. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const onChainId = Number(id);
  if (!Number.isInteger(onChainId) || onChainId < 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });

  const { data, error } = await admin
    .from("forfeit_commitments")
    .select(SUPPORT_COMMITMENT_SELECT)
    .eq("on_chain_commitment_id", onChainId)
    .eq("is_private", false)
    .neq("status", "pending_confirmation")
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const row = data as unknown as SupportCommitmentRow;

  const [chain, kept, faces, recentRes] = await Promise.all([
    loadChainState([onChainId]),
    loadKeptPeriods(admin, [row.id]),
    loadSupporterFaces(admin, [row.id], 5),
    admin
      .from("delulu_supports")
      .select("id, supporter_wallet, amount_wei::text, confirmed_at")
      .eq("commitment_id", row.id)
      .eq("status", "confirmed")
      .order("confirmed_at", { ascending: false })
      .limit(RECENT_LIMIT),
  ]);
  const recentRows = (recentRes.data ?? []) as {
    id: string;
    supporter_wallet: string;
    amount_wei: string;
    confirmed_at: string;
  }[];
  const profiles = await loadPublicProfiles(admin, [row.creator_wallet, ...recentRows.map((r) => r.supporter_wallet)]);

  const dto = toPublicDelulu(row, {
    profile: profiles.get(row.creator_wallet.toLowerCase()),
    chain: chain.get(onChainId),
    kept: kept.get(row.id),
    faces: faces.get(row.id),
    viewer: getAuthenticatedWallet(request),
  });

  return NextResponse.json({
    ...dto,
    recent: recentRows.map((r) => ({
      id: r.id,
      supporter: profiles.get(r.supporter_wallet.toLowerCase()) ?? { username: null, pfpUrl: null },
      amountG: weiToWhole(r.amount_wei),
      at: r.confirmed_at,
    })),
  });
}

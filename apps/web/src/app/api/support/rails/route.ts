import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getAuthenticatedWallet } from "@/lib/auth/wallet-session";
import {
  SUPPORT_COMMITMENT_SELECT,
  buildPublicDelulus,
  type PublicDeluluDto,
  type SupportCommitmentRow,
} from "@/lib/support/server";

export const dynamic = "force-dynamic";

const POOL = 120;
const PER_RAIL = 10;
const FINAL_STRETCH_MS = 3 * 86_400_000;

export type SupportRailsDto = {
  onFire: PublicDeluluDto[];
  beFirst: PublicDeluluDto[];
  finalStretch: PublicDeluluDto[];
};

/**
 * Curated rows for the top of the Support page, from the same public-only
 * pool as discovery. A goal can appear in more than one row.
 */
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 503 });
  const viewer = getAuthenticatedWallet(request);

  const { data, error } = await admin
    .from("forfeit_commitments")
    .select(SUPPORT_COMMITMENT_SELECT)
    .eq("is_private", false)
    .eq("status", "active")
    .not("on_chain_commitment_id", "is", null)
    .or(`ends_at.is.null,ends_at.gt.${new Date().toISOString()}`)
    .order("public_since", { ascending: false, nullsFirst: false })
    .limit(POOL);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const all = (await buildPublicDelulus(admin, (data ?? []) as unknown as SupportCommitmentRow[], viewer)).filter(
    (d) => d.accepting,
  );
  const rate = (d: PublicDeluluDto) => d.progress.kept / Math.max(1, d.progress.currentDay);

  const onFire = all
    .filter((d) => d.progress.streak >= 2)
    .sort((a, b) => b.progress.streak - a.progress.streak || rate(b) - rate(a))
    .slice(0, PER_RAIL);
  const beFirst = all.filter((d) => d.support.supporters === 0 && !d.isOwn).slice(0, PER_RAIL);
  const now = Date.now();
  const finalStretch = all
    .filter((d) => d.endsAt && Date.parse(d.endsAt) - now < FINAL_STRETCH_MS && rate(d) >= 0.5)
    .sort((a, b) => Date.parse(a.endsAt!) - Date.parse(b.endsAt!))
    .slice(0, PER_RAIL);

  return NextResponse.json(
    { onFire, beFirst, finalStretch } satisfies SupportRailsDto,
    { headers: { "Cache-Control": "private, max-age=30" } },
  );
}

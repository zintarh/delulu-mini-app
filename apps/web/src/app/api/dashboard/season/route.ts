import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { loadSeasonReport } from "@/lib/analytics/season";
import { EPOCH_COUNT } from "@/lib/referral/campaign";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** GET — the Season report: each epoch and week, targets vs actuals. */
export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  return NextResponse.json(await loadSeasonReport(admin));
}

/** POST { epoch, circulationTarget } — set an epoch's G$ circulation goal. */
export async function POST(request: NextRequest) {
  const { session, error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const epoch = Number(body.epoch);
  const target = Number(body.circulationTarget);
  if (!Number.isInteger(epoch) || epoch < 1 || epoch > EPOCH_COUNT) return NextResponse.json({ error: "Unknown epoch" }, { status: 400 });
  if (!Number.isInteger(target) || target < 0) return NextResponse.json({ error: "Target must be a whole number of G$" }, { status: 400 });
  const { error: dbError } = await admin
    .from("season_epoch_targets")
    .upsert({ epoch, circulation_target: target, updated_at: new Date().toISOString(), updated_by: session.email }, { onConflict: "epoch" });
  if (dbError) {
    const hint = /season_epoch_targets/.test(dbError.message) ? " — run docs/migrations/20261118_referral_round_slots.sql" : "";
    return NextResponse.json({ error: `${dbError.message}${hint}` }, { status: 500 });
  }
  return NextResponse.json(await loadSeasonReport(admin));
}

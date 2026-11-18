import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { REFERRAL_ROUNDS } from "@/lib/referral/campaign";
import { allRoundSlots, invalidateSlotsCache } from "@/lib/referral/slots";

export const dynamic = "force-dynamic";

/** GET — every referral round with its spots and how many are taken. */
export async function GET() {
  const { error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  return NextResponse.json({ rounds: await allRoundSlots(admin) });
}

/** POST { roundStart, slots } — set how many friends a round can credit. */
export async function POST(request: NextRequest) {
  const { session, error } = await requirePlatformAdmin();
  if (error) return error;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const body = await request.json().catch(() => ({}));
  const roundStart = String(body.roundStart ?? "");
  const slots = Number(body.slots);
  if (!REFERRAL_ROUNDS.some((r) => r.start === roundStart)) return NextResponse.json({ error: "Unknown round" }, { status: 400 });
  if (!Number.isInteger(slots) || slots < 0 || slots > 100_000) return NextResponse.json({ error: "Spots must be a whole number, 0 or more" }, { status: 400 });
  const { error: dbError } = await admin
    .from("referral_round_slots")
    .upsert({ round_start: roundStart, slots, updated_at: new Date().toISOString(), updated_by: session.email }, { onConflict: "round_start" });
  if (dbError) {
    const hint = /referral_round_slots/.test(dbError.message) ? " — run docs/migrations/20261118_referral_round_slots.sql" : "";
    return NextResponse.json({ error: `${dbError.message}${hint}` }, { status: 500 });
  }
  invalidateSlotsCache();
  return NextResponse.json({ rounds: await allRoundSlots(admin) });
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { loadOutreachPeople, type OutreachPerson } from "@/lib/outreach/activity";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export type WinbackDto = { people: OutreachPerson[]; generatedAt: string };

/** GET /api/dashboard/winback[?fresh=1] — everyone who ever proved, with activity and rewards. */
export async function GET(request: NextRequest) {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  try {
    const people = await loadOutreachPeople(admin, { fresh: request.nextUrl.searchParams.get("fresh") === "1" });
    const body: WinbackDto = { people, generatedAt: new Date().toISOString() };
    return NextResponse.json(body);
  } catch (err) {
    console.error("[dashboard/winback] load failed", err);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed to load" }, { status: 500 });
  }
}

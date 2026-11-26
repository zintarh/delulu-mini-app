import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { readFlowVoteSetting, saveFlowVoteEnabled } from "@/lib/app-settings";

export const dynamic = "force-dynamic";

/** GET /api/dashboard/app-settings — the voting popup switch. */
export async function GET() {
  const { error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  try {
    return NextResponse.json({ flowVote: await readFlowVoteSetting(admin) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load";
    return NextResponse.json({ error: /app_settings/.test(message) ? "Run docs/migrations/20261126_app_settings.sql first." : message }, { status: 500 });
  }
}

/** PUT /api/dashboard/app-settings  Body: { flowVote: boolean } */
export async function PUT(request: NextRequest) {
  const { session, error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  const body = (await request.json().catch(() => null)) as { flowVote?: unknown } | null;
  if (typeof body?.flowVote !== "boolean") return NextResponse.json({ error: "flowVote must be true or false" }, { status: 400 });
  try {
    const flowVote = await saveFlowVoteEnabled(admin, body.flowVote, session.email);
    console.info("[app-settings] flow_vote", body.flowVote ? "on" : "off", "by", session.email);
    return NextResponse.json({ flowVote });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save";
    return NextResponse.json({ error: /app_settings/.test(message) ? "Run docs/migrations/20261126_app_settings.sql first." : message }, { status: 500 });
  }
}

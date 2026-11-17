import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { buildBingoView } from "@/lib/bingo/read";
import { viewerWallet } from "@/lib/bingo/viewer";
import type { BingoCampaignRow } from "@/lib/bingo/types";

export const dynamic = "force-dynamic";

/** Live Bingos with their current (or next) cycle and the viewer's card. */
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const viewer = viewerWallet(request);

  const { data, error } = await admin
    .from("bingo_campaigns")
    .select("*")
    .in("status", ["live", "paused"])
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const views = (await Promise.all(((data ?? []) as BingoCampaignRow[]).map((c) => buildBingoView(admin, c, viewer)))).filter(
    // Only what's running or announced (starts within a day) — next week's Bingo waits its turn.
    (v) => v && v.visible,
  );
  return NextResponse.json({ bingos: views });
}

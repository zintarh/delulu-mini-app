import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { viewerWallet } from "@/lib/bingo/viewer";
import { currentPot } from "@/lib/pool/active-pot";

export const dynamic = "force-dynamic";

/** GET — this week's Active Pot: size, players on track, and the viewer's standing. */
export async function GET(request: NextRequest) {
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const pot = await currentPot(admin, viewerWallet(request));
  return NextResponse.json(pot, { headers: { "Cache-Control": "private, max-age=30" } });
}

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { viewerWallet } from "@/lib/bingo/viewer";
import { loadCheerContest } from "@/lib/bingo/cheers-server";

export const dynamic = "force-dynamic";

/** GET — this Bingo's "Best card" contest this week: prize, top cards by cheers, the viewer's cheers today. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });
  const { data: campaign } = await admin.from("bingo_campaigns").select("id").eq("slug", slug).maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Bingo not found" }, { status: 404 });
  return NextResponse.json(await loadCheerContest(admin, String(campaign.id), viewerWallet(request)));
}

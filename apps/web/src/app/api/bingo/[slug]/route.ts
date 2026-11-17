import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { buildBingoView } from "@/lib/bingo/read";
import { viewerWallet } from "@/lib/bingo/viewer";
import type { BingoCampaignRow } from "@/lib/bingo/types";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin.from("bingo_campaigns").select("*").eq("slug", slug).neq("status", "draft").maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Bingo not found" }, { status: 404 });

  const view = await buildBingoView(admin, campaign as BingoCampaignRow, viewerWallet(request));
  if (!view) return NextResponse.json({ error: "Bingo not found" }, { status: 404 });

  const { data: past } = await admin
    .from("bingo_cycles")
    .select("id, cycle_number, starts_at, ends_at")
    .eq("campaign_id", campaign.id)
    .eq("status", "archived")
    .order("cycle_number", { ascending: false })
    .limit(20);

  return NextResponse.json({ bingo: view, pastCycles: past ?? [] });
}

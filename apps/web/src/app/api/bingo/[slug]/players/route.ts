import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { cardViews } from "@/lib/bingo/read";
import { viewerWallet } from "@/lib/bingo/viewer";
import { DAY_MS, type BingoAttemptRow, type BingoCampaignRow, type BingoVersionRow } from "@/lib/bingo/types";

export const dynamic = "force-dynamic";
const PAGE = 20;

/**
 * Rolling Bingos: everyone's cards from the last few days, newest start
 * first. Each card runs on its own clock, so there's no shared ranking —
 * the UI shows each player's own day ("Day 2 · 1/3") instead.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? 0) || 0);
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: campaign } = await admin.from("bingo_campaigns").select("*").eq("slug", slug).neq("status", "draft").maybeSingle();
  if (!campaign) return NextResponse.json({ error: "Bingo not found" }, { status: 404 });
  const c = campaign as BingoCampaignRow;
  if (!c.current_version_id) return NextResponse.json({ cards: [], total: 0, hasMore: false });

  const since = new Date(Date.now() - (c.duration_days + 2) * DAY_MS).toISOString();
  const [{ data: version }, { data: attempts, count }] = await Promise.all([
    admin.from("bingo_versions").select("*").eq("id", c.current_version_id).single(),
    admin
      .from("bingo_attempts")
      .select("*", { count: "exact" })
      .eq("campaign_id", c.id)
      .is("cycle_id", null)
      .gte("started_at", since)
      .order("started_at", { ascending: false })
      .range(page * PAGE, page * PAGE + PAGE - 1),
  ]);
  const v = version as BingoVersionRow;
  const cards = await cardViews(admin, (attempts ?? []) as BingoAttemptRow[], v.missions, v.tiers.map((t) => ({ tier_key: t.key, label: t.label })), {
    cycleOver: false,
    viewer: viewerWallet(request),
    durationDays: c.duration_days,
  });
  return NextResponse.json({
    cards: cards.map((card, i) => ({ ...card, rank: page * PAGE + i + 1 })),
    total: count ?? 0,
    hasMore: (count ?? 0) > (page + 1) * PAGE,
  });
}

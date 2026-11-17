import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { cardViews } from "@/lib/bingo/read";
import { viewerWallet } from "@/lib/bingo/viewer";
import { cyclePhase, type BingoAttemptRow, type BingoCycleRow, type BingoCycleTierRow, type BingoVersionRow } from "@/lib/bingo/types";

export const dynamic = "force-dynamic";
const PAGE = 20;

/**
 * Leaderboard + everyone's card for one cycle (current or archived): most
 * squares first, ties to whoever got there first. Only approved squares show.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const page = Math.max(0, Number(request.nextUrl.searchParams.get("page") ?? 0) || 0);
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "DB unavailable" }, { status: 500 });

  const { data: cycle } = await admin.from("bingo_cycles").select("*").eq("id", id).maybeSingle();
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  const c = cycle as BingoCycleRow;

  const [{ data: version }, { data: tiers }, { data: attempts, count }] = await Promise.all([
    admin.from("bingo_versions").select("*").eq("id", c.version_id).single(),
    admin.from("bingo_cycle_tiers").select("*").eq("cycle_id", c.id),
    admin
      .from("bingo_attempts")
      .select("*", { count: "exact" })
      .eq("cycle_id", c.id)
      .neq("status", "left")
      .order("squares_filled", { ascending: false })
      .order("last_filled_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true })
      .range(page * PAGE, page * PAGE + PAGE - 1),
  ]);

  const cards = await cardViews(
    admin,
    (attempts ?? []) as BingoAttemptRow[],
    (version as BingoVersionRow).missions,
    (tiers ?? []) as BingoCycleTierRow[],
    { cycleOver: cyclePhase(c) === "ended", viewer: viewerWallet(request), durationDays: Math.round((Date.parse(c.ends_at) - Date.parse(c.starts_at)) / 86_400_000) },
  );

  return NextResponse.json({
    cycle: { id: c.id, number: c.cycle_number, startsAt: c.starts_at, endsAt: c.ends_at, phase: cyclePhase(c) },
    cards: cards.map((card, i) => ({ ...card, rank: page * PAGE + i + 1 })),
    total: count ?? 0,
    hasMore: (count ?? 0) > (page + 1) * PAGE,
  });
}

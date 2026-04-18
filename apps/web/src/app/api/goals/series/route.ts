import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// POST /api/goals/series — save the full roadmap after Step C
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { creatorAddress, ultimateGoal, habits, aiSideEffects } = body;

    if (!creatorAddress || !ultimateGoal || !Array.isArray(habits)) {
      return errorResponse("creatorAddress, ultimateGoal and habits are required", 400);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    // Create the parent series
    const { data: series, error: seriesError } = await supabase
      .from("goal_series")
      .insert({
        creator_address: creatorAddress.toLowerCase(),
        ultimate_goal: ultimateGoal,
        ai_side_effects: aiSideEffects ?? null,
        status: "active",
      })
      .select()
      .single();

    if (seriesError) throw seriesError;

    // Insert all habits (including already_has ones, just marked)
    const habitRows = habits.map((h: any, i: number) => ({
      goal_series_id: series.id,
      habit_id: h.id,
      title: h.title,
      description: h.description ?? null,
      priority: h.priority,
      category: h.category ?? "other",
      suggested_days: h.suggestedDays ?? 60,
      already_has: h.alreadyHas ?? false,
      status: h.alreadyHas ? "skipped" : "pending",
      sort_order: i,
      emoji: h.emoji ?? "🎯",
    }));

    const { error: habitsError } = await supabase
      .from("goal_series_habits")
      .insert(habitRows);

    if (habitsError) throw habitsError;

    return jsonResponse({ seriesId: series.id }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/goals/series]", err);
    return errorResponse(err?.message || "Failed to create goal series", 500);
  }
}

// GET /api/goals/series?address=0x... — get active series for a wallet
export async function GET(req: NextRequest) {
  try {
    const address = req.nextUrl.searchParams.get("address")?.toLowerCase();
    if (!address) return errorResponse("address is required", 400);

    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    const { data, error } = await supabase
      .from("goal_series")
      .select(`
        *,
        goal_series_habits (*)
      `)
      .eq("creator_address", address)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return jsonResponse({ series: data });
  } catch (err: any) {
    console.error("[GET /api/goals/series]", err);
    return errorResponse(err?.message || "Failed to fetch series", 500);
  }
}

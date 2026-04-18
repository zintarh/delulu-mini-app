import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// PATCH /api/goals/series/[id]/habits/[habitId]
// Update a habit's status or link it to an on-chain delulu
export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string; habitId: string } }
) {
  try {
    const { id: seriesId, habitId } = params;
    const body = await req.json();
    const { status, onChainId, creatorAddress } = body;

    if (!creatorAddress) return errorResponse("creatorAddress required", 400);

    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    // Verify the series belongs to this creator
    const { data: series, error: fetchError } = await supabase
      .from("goal_series")
      .select("creator_address")
      .eq("id", seriesId)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!series) return errorResponse("Series not found", 404);
    if (series.creator_address !== creatorAddress.toLowerCase()) {
      return errorResponse("Unauthorized", 403);
    }

    const updates: Record<string, any> = { updated_at: new Date().toISOString() };
    if (status) updates.status = status;
    if (onChainId) updates.on_chain_id = onChainId;

    const { error } = await supabase
      .from("goal_series_habits")
      .update(updates)
      .eq("goal_series_id", seriesId)
      .eq("habit_id", habitId);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error("[PATCH habits]", err);
    return errorResponse(err?.message || "Failed to update habit", 500);
  }
}

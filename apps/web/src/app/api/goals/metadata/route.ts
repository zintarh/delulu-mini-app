import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// POST /api/goals/metadata — create a metadata record after on-chain creation
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { onChainId, creatorAddress, titleOverride, descriptionOverride, imageOverride, goalSeriesId, habitId } = body;

    if (!onChainId || !creatorAddress) {
      return errorResponse("onChainId and creatorAddress are required", 400);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    const { error } = await supabase
      .from("delulu_metadata")
      .upsert({
        on_chain_id: String(onChainId),
        creator_address: creatorAddress.toLowerCase(),
        title_override: titleOverride ?? null,
        description_override: descriptionOverride ?? null,
        image_override: imageOverride ?? null,
        is_hidden: false,
        goal_series_id: goalSeriesId ?? null,
        habit_id: habitId ?? null,
        updated_at: new Date().toISOString(),
      });

    if (error) throw error;

    return jsonResponse({ success: true }, { status: 201 });
  } catch (err: any) {
    console.error("[POST /api/goals/metadata]", err);
    return errorResponse(err?.message || "Failed to create metadata", 500);
  }
}

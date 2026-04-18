import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// POST /api/goals/series/[id]/abandon
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { creatorAddress } = await req.json();
    if (!creatorAddress) return errorResponse("creatorAddress required", 400);

    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    const { data: series, error: fetchError } = await supabase
      .from("goal_series")
      .select("creator_address")
      .eq("id", params.id)
      .maybeSingle();

    if (fetchError) throw fetchError;
    if (!series) return errorResponse("Series not found", 404);
    if (series.creator_address !== creatorAddress.toLowerCase()) {
      return errorResponse("Unauthorized", 403);
    }

    const { error } = await supabase
      .from("goal_series")
      .update({ status: "abandoned" })
      .eq("id", params.id);

    if (error) throw error;

    return jsonResponse({ success: true });
  } catch (err: any) {
    console.error("[POST abandon]", err);
    return errorResponse(err?.message || "Failed to abandon series", 500);
  }
}

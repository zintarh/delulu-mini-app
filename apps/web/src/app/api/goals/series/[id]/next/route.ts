import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

// GET /api/goals/series/[id]/next — get next pending habit for a series
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    const { data, error } = await supabase
      .from("goal_series_habits")
      .select("*")
      .eq("goal_series_id", params.id)
      .eq("status", "pending")
      .eq("already_has", false)
      .order("sort_order", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return jsonResponse({ habit: data });
  } catch (err: any) {
    return errorResponse(err?.message || "Failed to fetch next habit", 500);
  }
}

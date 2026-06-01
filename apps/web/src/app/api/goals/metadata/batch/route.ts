import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";

/** GET /api/goals/metadata/batch?onChainIds=1,2,94 — title overrides for leaderboard */
export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseAdmin();
    if (!supabase) return errorResponse("Database not configured", 503);

    const raw = request.nextUrl.searchParams.get("onChainIds") || "";
    const onChainIds = Array.from(
      new Set(
        raw
          .split(",")
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ).slice(0, 200);

    if (onChainIds.length === 0) {
      return jsonResponse({ titles: {} });
    }

    const { data, error } = await supabase
      .from("delulu_metadata")
      .select("on_chain_id, title_override")
      .in("on_chain_id", onChainIds);

    if (error) throw error;

    const titles: Record<string, string | null> = {};
    for (const row of data ?? []) {
      const id = String((row as { on_chain_id: string }).on_chain_id);
      const title = (row as { title_override: string | null }).title_override;
      titles[id] = typeof title === "string" && title.trim() ? title.trim() : null;
    }

    return jsonResponse(
      { titles },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to fetch metadata";
    return errorResponse(message, 500);
  }
}

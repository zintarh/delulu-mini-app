import { NextRequest } from "next/server";
import { getTrendingDelulus } from "@/lib/db/delulus";
import { jsonResponse, errorResponse } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 50) : 10;

    const trending = await getTrendingDelulus(limit);

    // Compute TVL using totalSupportCollected when available (v2),
    // falling back to legacy believer/doubter sums if needed.
    const trendingWithTVL = trending.map((d: any) => {
      console.log(d, "jhjdhdhj");
      const tvl =
        typeof d.totalSupportCollected === "number" && !Number.isNaN(d.totalSupportCollected)
          ? d.totalSupportCollected : 0

      return {
        ...d,
        totalStake: tvl,
      };
    });

    return jsonResponse({ data: trendingWithTVL });
  } catch (error) {
    console.error("GET /api/delulus/trending error:", error);
    return errorResponse("Internal error");
  }
}

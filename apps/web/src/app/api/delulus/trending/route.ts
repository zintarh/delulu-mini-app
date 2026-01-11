import { NextRequest } from "next/server";
import { getTrendingDelulus } from "@/lib/db/delulus";
import { jsonResponse, errorResponse } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 50) : 10;

    const trending = await getTrendingDelulus(limit);

    // Add computed totalStake (TVL) to each delulu
    const trendingWithTVL = trending.map((d) => ({
      ...d,
      totalStake: d.totalBelieverStake + d.totalDoubterStake,
    }));

    return jsonResponse({ data: trendingWithTVL });
  } catch (error) {
    console.error("GET /api/delulus/trending error:", error);
    return errorResponse("Internal error");
  }
}

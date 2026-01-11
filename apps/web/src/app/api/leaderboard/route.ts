import { NextRequest } from "next/server";
import {
  getTopStakers,
  getTopEarners,
  getMostActiveUsers,
  getTopCreators,
} from "@/lib/db/leaderboard";
import { jsonResponse, errorResponse } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const type = searchParams.get("type") ?? "stakers";
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 50) : 10;

    let data;
    switch (type) {
      case "stakers":
        data = await getTopStakers(limit);
        break;
      case "earners":
        data = await getTopEarners(limit);
        break;
      case "active":
        data = await getMostActiveUsers(limit);
        break;
      case "creators":
        data = await getTopCreators(limit);
        break;
      default:
        return errorResponse("Invalid type. Use: stakers, earners, active, creators", 400);
    }

    return jsonResponse({ data, type });
  } catch (error) {
    console.error("GET /api/leaderboard error:", error);
    return errorResponse("Internal error");
  }
}

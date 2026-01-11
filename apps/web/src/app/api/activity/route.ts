import { NextRequest } from "next/server";
import { getRecentActivity, getUserActivity } from "@/lib/db/activity";
import { jsonResponse, errorResponse } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const address = searchParams.get("address");
    const limitParam = searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 50) : 20;

    const data = address
      ? await getUserActivity(address, limit)
      : await getRecentActivity(limit);

    return jsonResponse({ data });
  } catch (error) {
    console.error("GET /api/activity error:", error);
    return errorResponse("Internal error");
  }
}

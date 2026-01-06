import { NextRequest } from "next/server";
import { getDelulusByState, type DeluluState } from "@/lib/db/delulus";
import { jsonResponse, errorResponse } from "@/lib/api";

type Params = { params: Promise<{ state: string }> };

const validStates: DeluluState[] = ["open", "locked", "resolved", "cancelled"];

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const { state } = await params;

    if (!validStates.includes(state as DeluluState)) {
      return errorResponse(
        `Invalid state. Use: ${validStates.join(", ")}`,
        400
      );
    }

    const { searchParams } = request.nextUrl;
    const limitParam = searchParams.get("limit");
    const cursor = searchParams.get("cursor") ?? undefined;
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 50) : 20;

    const delulus = await getDelulusByState(state as DeluluState, { limit, cursor });

    // Add computed totalStake (TVL) to each delulu
    const delulusWithTVL = delulus.map((d) => ({
      ...d,
      totalStake: d.totalBelieverStake + d.totalDoubterStake,
    }));

    return jsonResponse({
      data: delulusWithTVL,
      state,
      nextCursor: delulus.length === limit ? delulus[delulus.length - 1]?.id : null,
    });
  } catch (error) {
    console.error("GET /api/delulus/state/[state] error:", error);
    return errorResponse("Internal error");
  }
}

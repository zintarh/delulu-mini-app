import { NextRequest } from "next/server";
import { getStakedDelulusByUser } from "@/lib/db/stakes";
import { jsonResponse, errorResponse } from "@/lib/api";

type Params = { params: Promise<{ address: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const { address } = await params;

    if (!address) {
      return errorResponse("Address required", 400);
    }

    const delulus = await getStakedDelulusByUser(address);

    // Add computed totalStake (TVL) to each delulu
    const delulusWithTVL = delulus.map((d) => ({
      ...d,
      totalStake: d.totalBelieverStake + d.totalDoubterStake,
    }));

    return jsonResponse({ data: delulusWithTVL });
  } catch (error) {
    console.error("GET /api/users/[address]/staked error:", error);
    return errorResponse("Internal error");
  }
}

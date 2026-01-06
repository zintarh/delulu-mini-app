import { NextRequest } from "next/server";
import { getStakesByUser, type StakeWithDelulu } from "@/lib/db/stakes";
import { getTotalClaimedByUser } from "@/lib/db/claims";
import { getDelulusByUser } from "@/lib/db/delulus";
import { jsonResponse, errorResponse } from "@/lib/api";

export async function GET(request: NextRequest) {
  try {
    const address = request.nextUrl.searchParams.get("address");

    if (!address) {
      return errorResponse("Address required", 400);
    }

    const [stakes, totalClaimed, delulus] = await Promise.all([
      getStakesByUser(address),
      getTotalClaimedByUser(address),
      getDelulusByUser(address),
    ]);

    const totalStaked = stakes.reduce(
      (acc: number, s: StakeWithDelulu) => acc + s.amount,
      0
    );
    const activeStakes = stakes.filter(
      (s: StakeWithDelulu) => new Date(s.delulu.stakingDeadline) > new Date()
    ).length;

    return jsonResponse({
      totalStaked,
      totalClaimed,
      activeStakes,
      totalDelulus: delulus.length,
      totalBets: stakes.length,
    });
  } catch (error) {
    console.error("GET /api/stats error:", error);
    return errorResponse("Internal error");
  }
}

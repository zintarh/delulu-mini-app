import { jsonResponse, errorResponse } from "@/lib/api";
import { db } from "@/lib/db";

export async function GET() {
  try {
    // Get platform-wide stats
    const [deluluStats, stakeStats, userCount] = await Promise.all([
      // Aggregate delulu stats
      db.delulu.aggregate({
        _sum: {
          totalBelieverStake: true,
          totalDoubterStake: true,
        },
        _count: {
          _all: true,
        },
      }),
      // Aggregate stake stats
      db.stake.aggregate({
        _sum: {
          amount: true,
        },
        _count: {
          _all: true,
        },
      }),
      // Total users
      db.user.count(),
    ]);

    const totalBelieverStake = deluluStats._sum.totalBelieverStake ?? 0;
    const totalDoubterStake = deluluStats._sum.totalDoubterStake ?? 0;
    const tvl = totalBelieverStake + totalDoubterStake;

    return jsonResponse({
      tvl, // Total Value Locked across all markets
      totalBelieverStake,
      totalDoubterStake,
      totalDelulus: deluluStats._count._all,
      totalStakes: stakeStats._count._all,
      totalStakeVolume: stakeStats._sum.amount ?? 0,
      totalUsers: userCount,
    });
  } catch (error) {
    console.error("GET /api/stats/platform error:", error);
    return errorResponse("Internal error");
  }
}

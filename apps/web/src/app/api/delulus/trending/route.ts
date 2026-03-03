import { NextRequest } from "next/server";
import { getTrendingDelulus } from "@/lib/db/delulus";
import { jsonResponse, errorResponse } from "@/lib/api";
import { CELO_MAINNET_ID, getSubgraphUrlForChain } from "@/lib/constant";

async function fetchTotalSupportCollectedMap(
  onChainIds: Array<bigint | number | string>
): Promise<Record<string, number>> {
  const url = getSubgraphUrlForChain(CELO_MAINNET_ID);
  if (!url) return {};

  const ids = onChainIds
    .map((id) => id?.toString())
    .filter((id): id is string => Boolean(id));

  if (ids.length === 0) return {};

  const query = `
    query GetTrendingSupport($ids: [ID!]!) {
      delulus(where: { id_in: $ids }) {
        id
        totalSupportCollected
      }
    }
  `;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        variables: { ids },
      }),
    });

    const json = await res.json();
    const delulus = json?.data?.delulus as
      | Array<{ id: string; totalSupportCollected: string | number | null }>
      | undefined;

    if (!delulus) return {};

    const map: Record<string, number> = {};
    for (const d of delulus) {
      const value = Number(d.totalSupportCollected ?? 0);
      map[d.id] = Number.isFinite(value) ? value : 0;
    }
    return map;
  } catch {
    // If subgraph lookup fails, fall back to zeros
    return {};
  }
}

export async function GET(request: NextRequest) {
  try {
    const limitParam = request.nextUrl.searchParams.get("limit");
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam), 1), 50) : 10;

    const trending = await getTrendingDelulus(limit);

    // Look up TVL (totalSupportCollected) from the subgraph using on-chain IDs
    const onChainIds = (trending as any[]).map((d) => d.onChainId);
    const supportMap = await fetchTotalSupportCollectedMap(onChainIds);

    const trendingWithTVL = trending.map((d: any) => {
      const key =
        typeof d.onChainId === "bigint"
          ? d.onChainId.toString()
          : d.onChainId
          ? String(d.onChainId)
          : "";

      const tvl = key ? supportMap[key] ?? 0 : 0;

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

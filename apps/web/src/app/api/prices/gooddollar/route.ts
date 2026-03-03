import { NextRequest } from "next/server";
import { jsonResponse, errorResponse } from "@/lib/api";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";

// Simple in-memory cache for serverless function lifespan
let cachedPrice: { value: number; timestamp: number } | null = null;
const CACHE_TTL_MS = 60_000; // 1 minute

export async function GET(_req: NextRequest) {
  try {
    const now = Date.now();
    if (cachedPrice && now - cachedPrice.timestamp < CACHE_TTL_MS) {
      return jsonResponse({ usd: cachedPrice.value });
    }

    const contract = GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();

    // CoinGecko token price endpoint for Celo tokens
    const url = `https://api.coingecko.com/api/v3/simple/token_price/celo?contract_addresses=${contract}&vs_currencies=usd`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
      },
      // Be explicit that this can be cached by hosting infra if desired
      next: { revalidate: 60 },
    });

    if (!res.ok) {
      throw new Error(`CoinGecko error: ${res.status}`);
    }

    const json = (await res.json()) as Record<
      string,
      { usd?: number | null }
    >;

    const entry = json[contract];
    const price = entry?.usd;

    if (typeof price !== "number" || !Number.isFinite(price)) {
      throw new Error("Invalid price data from CoinGecko");
    }

    cachedPrice = { value: price, timestamp: now };
    return jsonResponse({ usd: price });
  } catch (error) {
    console.error("GET /api/prices/gooddollar error:", error);
    // Fallback to 0 so UI can handle "no price" gracefully
    return errorResponse("Failed to fetch G$ price", 502);
  }
}


import {
  CUSD_ADDRESSES,
  GOODDOLLAR_ADDRESSES,
  USDT_ADDRESSES,
  isGoodDollarToken,
  isUsdtToken,
} from "@/lib/constant";

const ZERO = "0x0000000000000000000000000000000000000000";

/** Native CELO / empty — never counted toward earned. */
export function isExcludedEarnedToken(tokenAddress: string | null | undefined): boolean {
  if (!tokenAddress) return true;
  const lc = tokenAddress.toLowerCase();
  if (lc === ZERO) return true;
  // Native CELO has no ERC-20 address in our claim flows; treat bare "celo" as excluded.
  if (lc === "celo" || lc === "native") return true;
  return false;
}

export function isUsdStableToken(tokenAddress: string | null | undefined): boolean {
  if (!tokenAddress) return false;
  const lc = tokenAddress.toLowerCase();
  return (
    isUsdtToken(tokenAddress) ||
    lc === CUSD_ADDRESSES.mainnet.toLowerCase() ||
    lc === USDT_ADDRESSES.mainnet.toLowerCase()
  );
}

let cachedGdUsd: { usd: number; at: number } | null = null;
const GD_PRICE_TTL_MS = 60_000;

export async function fetchGoodDollarUsdPrice(): Promise<number | null> {
  if (cachedGdUsd && Date.now() - cachedGdUsd.at < GD_PRICE_TTL_MS) {
    return cachedGdUsd.usd;
  }
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=gooddollar&vs_currencies=usd",
      { headers: { accept: "application/json" }, next: { revalidate: 60 } },
    );
    if (!res.ok) return cachedGdUsd?.usd ?? null;
    const json = (await res.json()) as { gooddollar?: { usd?: number } };
    const usd = json?.gooddollar?.usd;
    if (typeof usd === "number" && Number.isFinite(usd) && usd > 0) {
      cachedGdUsd = { usd, at: Date.now() };
      return usd;
    }
  } catch {
    // fall through
  }
  return cachedGdUsd?.usd ?? null;
}

/**
 * Convert a human-unit token amount received via the app into USDT/USD.
 * Returns 0 for CELO / unknown tokens that cannot be priced.
 */
export async function tokenAmountToUsdt(
  amount: number,
  tokenAddress: string | null | undefined,
): Promise<number> {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (isExcludedEarnedToken(tokenAddress)) return 0;

  if (isUsdStableToken(tokenAddress)) {
    return amount;
  }

  if (isGoodDollarToken(tokenAddress ?? undefined)) {
    const price = await fetchGoodDollarUsdPrice();
    if (price == null) return 0;
    return amount * price;
  }

  // Default known market token when address omitted (legacy G$ markets).
  if (!tokenAddress) {
    const price = await fetchGoodDollarUsdPrice();
    if (price == null) return 0;
    return amount * price;
  }

  return 0;
}

export const DEFAULT_EARNED_TOKEN = GOODDOLLAR_ADDRESSES.mainnet;

import { formatUnits, parseUnits } from "viem";
import {
  CUSD_ADDRESSES,
  GOODDOLLAR_ADDRESSES,
  KNOWN_TOKEN_SYMBOLS,
  USDT_ADDRESSES,
  isGoodDollarToken,
  isUsdtToken,
} from "@/lib/constant";

export const DEFAULT_TOKEN_DECIMALS = 18;
/** Matches on-chain MIN_STAKE_WHOLE after the decimal-aware upgrade. */
export const MIN_STAKE_WHOLE = 100;

/** Static decimals for known Celo tokens (avoids extra RPC on hot paths). */
export const TOKEN_DECIMALS_BY_ADDRESS: Record<string, number> = {
  [GOODDOLLAR_ADDRESSES.mainnet.toLowerCase()]: 18,
  [USDT_ADDRESSES.mainnet.toLowerCase()]: 6,
  [CUSD_ADDRESSES.mainnet.toLowerCase()]: 18,
};

export function getTokenDecimals(
  tokenAddress: string | undefined | null,
  fallbackDecimals?: number,
): number {
  if (fallbackDecimals != null) return fallbackDecimals;
  if (!tokenAddress) return DEFAULT_TOKEN_DECIMALS;
  return (
    TOKEN_DECIMALS_BY_ADDRESS[tokenAddress.toLowerCase()] ??
    DEFAULT_TOKEN_DECIMALS
  );
}

export function getTokenSymbol(tokenAddress: string | undefined | null): string {
  if (!tokenAddress) return "tokens";
  return KNOWN_TOKEN_SYMBOLS[tokenAddress.toLowerCase()] ?? "?";
}

export function weiToTokenAmount(
  weiStr: string | undefined | null,
  tokenAddress?: string | null,
  decimals?: number,
): number {
  if (!weiStr || weiStr === "0") return 0;
  const dec = getTokenDecimals(tokenAddress, decimals);
  return parseFloat(formatUnits(BigInt(weiStr), dec));
}

export function parseTokenAmount(
  amount: number | string,
  tokenAddress?: string | null,
  decimals?: number,
): bigint {
  const dec = getTokenDecimals(tokenAddress, decimals);
  return parseUnits(String(amount), dec);
}

export function minStakeWei(
  tokenAddress: string | undefined | null,
  decimals?: number,
): bigint {
  const dec = getTokenDecimals(tokenAddress, decimals);
  return BigInt(MIN_STAKE_WHOLE) * 10n ** BigInt(dec);
}

/** Stablecoins shown as ≈ $X without a price API. */
export function isUsdPeggedToken(tokenAddress: string | undefined | null): boolean {
  if (!tokenAddress) return false;
  const lc = tokenAddress.toLowerCase();
  return (
    isUsdtToken(tokenAddress) ||
    lc === CUSD_ADDRESSES.mainnet.toLowerCase()
  );
}

export function getTipQuickAmounts(tokenAddress: string | undefined | null): number[] {
  if (isGoodDollarToken(tokenAddress ?? undefined)) return [100, 200, 500, 1000];
  if (isUsdtToken(tokenAddress ?? undefined)) return [10, 25, 50, 100];
  return [10, 25, 50, 100];
}

export function getDefaultTipAmount(tokenAddress: string | undefined | null): number {
  if (isGoodDollarToken(tokenAddress ?? undefined)) return 100;
  if (isUsdtToken(tokenAddress ?? undefined)) return 25;
  return 25;
}

export function formatUsdEquivalent(
  amount: number,
  tokenAddress: string | undefined | null,
  gDollarUsdPrice: number | null | undefined,
): string | null {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return null;
  if (isGoodDollarToken(tokenAddress ?? undefined)) {
    if (!gDollarUsdPrice) return null;
    return (amount * gDollarUsdPrice).toFixed(2);
  }
  if (isUsdPeggedToken(tokenAddress)) {
    return amount.toFixed(2);
  }
  return null;
}

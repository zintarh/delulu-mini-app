import { formatUnits, parseUnits } from "viem";
import {
  CUSD_ADDRESSES,
  KNOWN_TOKEN_SYMBOLS,
  USDT_ADDRESSES,
  isUsdtToken,
} from "@/lib/constant";

export const DEFAULT_TOKEN_DECIMALS = 18;
export const MIN_STAKE_WHOLE = 100;
export const MIN_STAKE_STABLECOIN = 1;

export function getMinStakeWhole(tokenAddress: string | undefined | null): number {
  const dec = getTokenDecimals(tokenAddress);
  return dec < 18 ? MIN_STAKE_STABLECOIN : MIN_STAKE_WHOLE;
}

export const TOKEN_DECIMALS_BY_ADDRESS: Record<string, number> = {
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
  const minWhole = getMinStakeWhole(tokenAddress);
  return BigInt(minWhole) * 10n ** BigInt(dec);
}

export function isUsdPeggedToken(tokenAddress: string | undefined | null): boolean {
  if (!tokenAddress) return false;
  const lc = tokenAddress.toLowerCase();
  return (
    isUsdtToken(tokenAddress) ||
    lc === CUSD_ADDRESSES.mainnet.toLowerCase()
  );
}

export function getTipQuickAmounts(_tokenAddress: string | undefined | null): number[] {
  return [10, 25, 50, 100];
}

export function getDefaultTipAmount(tokenAddress: string | undefined | null): number {
  return isUsdPeggedToken(tokenAddress) ? 1 : 25;
}

export function formatUsdEquivalent(
  amount: number,
  tokenAddress: string | undefined | null,
  _gDollarUsdPrice: number | null | undefined,
): string | null {
  if (!amount || !Number.isFinite(amount) || amount <= 0) return null;
  if (isUsdPeggedToken(tokenAddress)) {
    return amount.toFixed(2);
  }
  return null;
}

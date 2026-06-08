import { CELO_MAINNET_ID } from "@/lib/constant";

/**
 * USDT fee-currency adapter on Celo mainnet.
 * Use the adapter (not the token address) for 6-decimal fee currencies.
 * @see https://docs.celo.org/developer/fee-currency
 */
export const USDT_FEE_CURRENCY_ADAPTER_MAINNET =
  "0x0e2a3e05bc9a16f5292a6170456a710cb89c6f72" as const;

/** Pay gas in USDT on Celo mainnet (MiniPay / Valora). */
export function getUsdtFeeCurrency(
  chainId?: number,
): `0x${string}` | undefined {
  if (chainId === undefined || chainId === CELO_MAINNET_ID) {
    return USDT_FEE_CURRENCY_ADAPTER_MAINNET;
  }
  return undefined;
}

export function withUsdtFeeCurrency<T extends Record<string, unknown>>(
  params: T,
  chainId?: number,
): T & { feeCurrency?: `0x${string}` } {
  const feeCurrency = getUsdtFeeCurrency(chainId);
  if (!feeCurrency) return params;
  return { ...params, feeCurrency };
}

import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";

/**
 * "Buy G$": Uniswap on Celo with G$ already picked as what they get. Shown
 * as "Buy G$" (never "swap") wherever a bigger stake is suggested, for
 * players who already hold other money on Celo.
 */
export const BUY_GD_URL = `https://app.uniswap.org/swap?chain=celo&outputCurrency=${GOODDOLLAR_ADDRESSES.mainnet}`;

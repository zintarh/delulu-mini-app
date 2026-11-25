import { keccak256, toHex } from "viem";

/** What a streak freeze costs: paid into the reward pot on-chain (RewardVault.purchase). */
export const STREAK_FREEZE_G = 500;

/** The payment's `ref`: ties it to one card's one day, so a payment can't be reused. */
export const freezeRef = (onChainId: number, slot: number) => keccak256(toHex(`streak-freeze:${onChainId}:${slot}`));

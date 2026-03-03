/**
 * Transformer utilities for converting Subgraph raw data → UI-ready types.
 *
 * The Graph returns BigInt as string (e.g. "1000000000000000000" = 1 cUSD).
 * Timestamps are Unix seconds as string (e.g. "1708000000").
 * Our UI expects `number` for amounts and `Date` for timestamps.
 */

import type { FormattedDelulu, GatekeeperConfig } from "@/lib/types";
import type { DeluluIPFSMetadata } from "@/lib/graph/ipfs-cache";
import { CUSD_ADDRESSES } from "@/lib/constant";

// ─── Scalar Conversions ──────────────────────────────────────────

/** Convert a BigInt string (wei, 18 decimals) to a human-readable number */
export function weiToNumber(weiStr: string | undefined | null): number {
  if (!weiStr || weiStr === "0") return 0;
  // Avoid floating-point issues by dividing via string manipulation
  // For up to 18 decimal digits
  const str = weiStr.padStart(19, "0"); // ensure at least 19 chars
  const integerPart = str.slice(0, str.length - 18) || "0";
  const decimalPart = str.slice(str.length - 18);
  return parseFloat(`${integerPart}.${decimalPart}`);
}

/** Convert a BigInt string (Unix seconds) to a JS Date */
export function timestampToDate(
  timestampStr: string | undefined | null
): Date {
  if (!timestampStr || timestampStr === "0") return new Date(0);
  const timestamp = Number(timestampStr);
  const date = new Date(timestamp * 1000);
  
  // Debug logging in development to catch conversion issues
  if (process.env.NODE_ENV === "development" && timestamp > 0) {
    const expectedTimestamp = Math.floor(date.getTime() / 1000);
    if (Math.abs(expectedTimestamp - timestamp) > 1) {
      console.warn("[timestampToDate] Potential conversion issue:", {
        input: timestampStr,
        parsedTimestamp: timestamp,
        createdDate: date.toISOString(),
        revertedTimestamp: expectedTimestamp,
        difference: expectedTimestamp - timestamp,
      });
    }
  }
  
  return date;
}

// ─── Subgraph → FormattedDelulu ─────────────────────────────────

/** Minimum shape returned by GetDelulus / GetActiveDelulus queries */
export interface SubgraphDeluluRaw {
  id: string;
  onChainId: string;
  creatorAddress: string;
  contentHash: string;
  stakingDeadline: string;
  resolutionDeadline: string;
  createdAt: string;
  creatorStake?: string;
  // Legacy fields from earlier subgraph versions (no longer present in v2 schema).
  // Keep them optional so older cached data or types still type-check.
  totalBelieverStake?: string;
  totalDoubterStake?: string;
  totalSupportCollected?: string;
  totalSupporters?: string;
  winningPool?: string;
  losingPool?: string;
  challengeId?: string | null;
  isResolved: boolean;
  isCancelled: boolean;
  outcome?: boolean | null;
  creator?: { id: string };
  // NEW: underlying ERC20 token for this market (multi-token architecture)
  token?: string;
}

/**
 * Transform a raw Subgraph delulu entity into the FormattedDelulu
 * interface that every UI component already consumes.
 *
 * `metadata` is the optional IPFS-resolved content (text, pfp, etc.).
 */
export function transformSubgraphDelulu(
  raw: SubgraphDeluluRaw,
  metadata?: DeluluIPFSMetadata | null
): FormattedDelulu {
  const believerStake = raw.totalBelieverStake
    ? weiToNumber(raw.totalBelieverStake)
    : 0;
  const doubterStake = raw.totalDoubterStake
    ? weiToNumber(raw.totalDoubterStake)
    : 0;

  // Parse ID - handle both onChainId (string number) and id (subgraph ID string)
  let parsedId = 0;
  if (raw.onChainId) {
    const parsed = parseInt(raw.onChainId, 10);
    if (!isNaN(parsed)) {
      parsedId = parsed;
    }
  }
  if (parsedId === 0 && raw.id) {
    // Try to extract number from subgraph ID (might be "1" or a full ID string)
    const parsed = parseInt(raw.id, 10);
    if (!isNaN(parsed)) {
      parsedId = parsed;
    }
  }

  return {
    id: parsedId,
    onChainId: raw.onChainId || raw.id,
    creator: raw.creatorAddress,
    tokenAddress: raw.token && raw.token.length > 0 ? raw.token : CUSD_ADDRESSES.mainnet,
    contentHash: raw.contentHash,
    content: metadata?.text ?? undefined,
    username: metadata?.username ?? undefined,
    pfpUrl: metadata?.pfpUrl ?? undefined,
    bgImageUrl: metadata?.bgImageUrl ?? undefined,
    gatekeeper: metadata?.gatekeeper
      ? ({
          enabled: metadata.gatekeeper.enabled,
          type: "country",
          value: metadata.gatekeeper.value ?? "",
          label: metadata.gatekeeper.label ?? "",
        } as GatekeeperConfig)
      : undefined,
    createdAt: timestampToDate(raw.createdAt),
    stakingDeadline: timestampToDate(raw.stakingDeadline),
    resolutionDeadline: timestampToDate(raw.resolutionDeadline),
    totalBelieverStake: believerStake,
    totalDoubterStake: doubterStake,
    totalStake: believerStake + doubterStake,
    totalSupportCollected: raw.totalSupportCollected ? weiToNumber(raw.totalSupportCollected) : undefined,
    totalSupporters: raw.totalSupporters ? Number(raw.totalSupporters) : undefined,
    challengeId: (() => {
      const result = raw.challengeId ? Number(raw.challengeId) : undefined;
      if (process.env.NODE_ENV === "development") {
        // eslint-disable-next-line no-console
        console.log("[transformSubgraphDelulu] challengeId transformation", {
          rawChallengeId: raw.challengeId,
          rawChallengeIdType: typeof raw.challengeId,
          transformedChallengeId: result,
          transformedChallengeIdType: typeof result,
        });
      }
      return result;
    })(),
    outcome: raw.outcome ?? false,
    isResolved: raw.isResolved,
    isCancelled: raw.isCancelled,
  };
}

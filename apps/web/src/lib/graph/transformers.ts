

import type { FormattedDelulu, GatekeeperConfig } from "@/lib/types";
import type { DeluluIPFSMetadata } from "@/lib/graph/ipfs-cache";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { normalizeDeluluImageSrc } from "@/lib/normalize-image-src";
import { weiToTokenAmount } from "@/lib/token-amounts";

export function weiToNumber(
  weiStr: string | undefined | null,
  tokenAddress?: string | null,
): number {
  return weiToTokenAmount(weiStr, tokenAddress);
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


export interface SubgraphDeluluRaw {
  id: string;
  onChainId: string;
  creatorAddress: string;
  contentHash: string;
  stakingDeadline: string;
  resolutionDeadline: string;
  createdAt: string;
  creatorStake?: string;
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
  creator?: { id: string; username?: string | null };
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
  const tokenAddr =
    raw.token && raw.token.length > 0 ? raw.token : GOODDOLLAR_ADDRESSES.mainnet;
  const believerStake = raw.totalBelieverStake
    ? weiToNumber(raw.totalBelieverStake, tokenAddr)
    : 0;
  const doubterStake = raw.totalDoubterStake
    ? weiToNumber(raw.totalDoubterStake, tokenAddr)
    : 0;
  const supportCollected = raw.totalSupportCollected
    ? weiToNumber(raw.totalSupportCollected, tokenAddr)
    : 0;
  const creatorStake = raw.creatorStake
    ? weiToNumber(raw.creatorStake, tokenAddr)
    : 0;

  let parsedId = 0;
  if (raw.onChainId) {
    const parsed = parseInt(raw.onChainId, 10);
    if (!isNaN(parsed)) {
      parsedId = parsed;
    }
  }
  if (parsedId === 0 && raw.id) {
    const parsed = parseInt(raw.id, 10);
    if (!isNaN(parsed)) {
      parsedId = parsed;
    }
  }

  return {
    id: parsedId,
    onChainId: raw.onChainId || raw.id,
    creator: raw.creatorAddress,
    tokenAddress: tokenAddr,
    contentHash: raw.contentHash,
    content: metadata?.text ?? undefined,
    username: metadata?.username ?? raw.creator?.username ?? undefined,
    pfpUrl: metadata?.pfpUrl ?? undefined,
    bgImageUrl: normalizeDeluluImageSrc(metadata?.bgImageUrl) ?? undefined,
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
    creatorStake: creatorStake > 0 ? creatorStake : undefined,
    totalStake: creatorStake + supportCollected,
    totalSupportCollected:
      creatorStake + supportCollected > 0
        ? creatorStake + supportCollected
        : undefined,
    totalSupporters: raw.totalSupporters ? Number(raw.totalSupporters) : undefined,
    challengeId: (() => {
      const result = raw.challengeId ? Number(raw.challengeId) : undefined;

      return result;
    })(),
    outcome: raw.outcome ?? false,
    isResolved: raw.isResolved,
    isCancelled: raw.isCancelled,
  };
}

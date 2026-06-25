import { createPublicClient, formatUnits, http, zeroAddress } from "viem";
import { celo } from "viem/chains";
import { COMMUNITY_CAMPAIGN_ABI } from "@/lib/abi/community-campaign";
import {
  DELULU_CHAIN_ID,
  getCommunityMarketV1Address,
  GOODDOLLAR_ADDRESSES,
  KNOWN_TOKEN_SYMBOLS,
} from "@/lib/constant";
import { formatJoinTokenLabel } from "@/lib/community/join-token";
import { getTokenDecimals } from "@/lib/token-amounts";

const publicClient = createPublicClient({
  chain: celo,
  transport: http(process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org"),
});

export type CampaignOnchainEconomics = {
  isPaid: boolean;
  joinAmountWei: bigint;
  joinAmount: number;
  joinTokenAddress: `0x${string}`;
  joinTokenLabel: string;
  fundedPoolWei: bigint;
  fundedPoolAmount: number;
  participantCount: number;
  totalParticipantStakesWei: bigint;
  totalParticipantStakes: number;
  totalPrizePoolWei: bigint;
  totalPrizePoolAmount: number;
};

function joinTokenLabelFromAddress(token: `0x${string}`): string {
  if (token === zeroAddress) return "G$";
  return KNOWN_TOKEN_SYMBOLS[token.toLowerCase()] ?? formatJoinTokenLabel(token);
}

function tokenDecimals(token: `0x${string}`): number {
  if (token === zeroAddress) return 18;
  return getTokenDecimals(token);
}

function weiToAmount(wei: bigint, token: `0x${string}`): number {
  return parseFloat(formatUnits(wei, tokenDecimals(token)));
}

/** Read paid-join config, funded pool, and accumulated participant stakes from chain. */
export async function fetchCampaignOnchainEconomics(
  challengeId: number,
): Promise<CampaignOnchainEconomics | null> {
  try {
    const contract = getCommunityMarketV1Address(DELULU_CHAIN_ID);
    const id = BigInt(challengeId);

    const [isPaid, joinAmountWei, joinTokenRaw, campaignRow, participantCount] =
      await Promise.all([
        publicClient.readContract({
          address: contract,
          abi: COMMUNITY_CAMPAIGN_ABI,
          functionName: "campaignIsPaid",
          args: [id],
        }),
        publicClient.readContract({
          address: contract,
          abi: COMMUNITY_CAMPAIGN_ABI,
          functionName: "campaignJoinAmount",
          args: [id],
        }),
        publicClient.readContract({
          address: contract,
          abi: COMMUNITY_CAMPAIGN_ABI,
          functionName: "campaignJoinToken",
          args: [id],
        }),
        publicClient.readContract({
          address: contract,
          abi: COMMUNITY_CAMPAIGN_ABI,
          functionName: "campaigns",
          args: [id],
        }),
        publicClient.readContract({
          address: contract,
          abi: COMMUNITY_CAMPAIGN_ABI,
          functionName: "campaignParticipantCount",
          args: [id],
        }),
      ]);

    const joinTokenAddress = (
      joinTokenRaw === zeroAddress ? GOODDOLLAR_ADDRESSES.mainnet : joinTokenRaw
    ) as `0x${string}`;
    const stakeTokenForMath = (
      joinTokenRaw === zeroAddress ? GOODDOLLAR_ADDRESSES.mainnet : joinTokenRaw
    ) as `0x${string}`;

    const fundedPoolWei = campaignRow[1] as bigint;
    const count = Number(participantCount);
    const totalParticipantStakesWei = isPaid ? joinAmountWei * BigInt(count) : 0n;

    const joinAmount = weiToAmount(joinAmountWei, stakeTokenForMath);
    const fundedPoolAmount = weiToAmount(
      fundedPoolWei,
      GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`,
    );
    const totalParticipantStakes = weiToAmount(
      totalParticipantStakesWei,
      stakeTokenForMath,
    );

    // Funded pool is always G$; stakes may be another token — sum only when same token.
    const sameToken =
      joinTokenRaw === zeroAddress ||
      joinTokenRaw.toLowerCase() === GOODDOLLAR_ADDRESSES.mainnet.toLowerCase();
    const totalPrizePoolWei = sameToken
      ? fundedPoolWei + totalParticipantStakesWei
      : fundedPoolWei;
    const totalPrizePoolAmount = sameToken
      ? fundedPoolAmount + totalParticipantStakes
      : fundedPoolAmount;

    return {
      isPaid,
      joinAmountWei,
      joinAmount,
      joinTokenAddress,
      joinTokenLabel: joinTokenLabelFromAddress(joinTokenRaw as `0x${string}`),
      fundedPoolWei,
      fundedPoolAmount,
      participantCount: count,
      totalParticipantStakesWei,
      totalParticipantStakes,
      totalPrizePoolWei,
      totalPrizePoolAmount,
    };
  } catch {
    return null;
  }
}

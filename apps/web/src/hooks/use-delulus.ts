import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { useEffect, useState } from "react";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export interface Delulu {
  id: bigint;
  creator: `0x${string}`;
  contentHash: string;
  stakingDeadline: bigint;
  resolutionDeadline: bigint;
  totalBelieverStake: bigint;
  totalDoubterStake: bigint;
  outcome: boolean;
  isResolved: boolean;
  isCancelled: boolean;
}

export interface FormattedDelulu {
  id: number;
  creator: string;
  contentHash: string;
  content?: string;
  username?: string;
  pfpUrl?: string;
  stakingDeadline: Date;
  resolutionDeadline: Date;
  totalBelieverStake: number;
  totalDoubterStake: number;
  totalStake: number;
  outcome: boolean;
  isResolved: boolean;
  isCancelled: boolean;
}

interface IPFSContent {
  text?: string;
  username?: string;
  pfpUrl?: string;
}

async function fetchIPFSContent(hash: string): Promise<IPFSContent | null> {
  try {
    const response = await fetch(`https://ipfs.io/ipfs/${hash}`, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
    });
    if (!response.ok) {
      console.warn(`IPFS fetch failed for ${hash}: ${response.status}`);
      return null;
    }
    const data = await response.json();
    // Pinata stores content in pinataContent
    const pinataContent = data.pinataContent || data;
    return {
      text: pinataContent.text || data.text || data.content || null,
      username: pinataContent.username || data.username || null,
      pfpUrl: pinataContent.pfpUrl || data.pfpUrl || null,
    };
  } catch (error) {
    console.error(`Failed to fetch IPFS content for ${hash}:`, error);
    return null;
  }
}

export function useDelulus() {
  const { data, isLoading, error } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getDelulus",
    args: [1n, 100n],
  });

  const [delulusWithContent, setDelulusWithContent] = useState<
    FormattedDelulu[]
  >([]);

  const rawDelulus: FormattedDelulu[] = data
    ? (data as Delulu[])
        .filter((d) => !d.isCancelled)
        .map((d) => {
          const believerStake = parseFloat(
            formatUnits(d.totalBelieverStake, 18)
          );
          const doubterStake = parseFloat(formatUnits(d.totalDoubterStake, 18));
          const totalStake = believerStake + doubterStake;

          return {
            id: Number(d.id),
            creator: d.creator,
            contentHash: d.contentHash,
            stakingDeadline: new Date(Number(d.stakingDeadline) * 1000),
            resolutionDeadline: new Date(Number(d.resolutionDeadline) * 1000),
            totalBelieverStake: believerStake,
            totalDoubterStake: doubterStake,
            totalStake,
            outcome: d.outcome,
            isResolved: d.isResolved,
            isCancelled: d.isCancelled,
          };
        })
        .sort((a, b) => b.totalStake - a.totalStake)
    : [];

  useEffect(() => {
    if (rawDelulus.length === 0) {
      setDelulusWithContent([]);
      return;
    }

    const fetchContents = async () => {
      const delulusWithDecoded = await Promise.all(
        rawDelulus.map(async (delulu) => {
          const ipfsData = await fetchIPFSContent(delulu.contentHash);

          return {
            ...delulu,
            content: ipfsData?.text || delulu.contentHash,
            username: ipfsData?.username,
            pfpUrl: ipfsData?.pfpUrl,
          };
        })
      );
      setDelulusWithContent(delulusWithDecoded);
    };

    fetchContents();
  }, [data]);

  return { delulus: delulusWithContent, isLoading, error };
}

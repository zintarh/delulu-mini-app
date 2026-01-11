import { type Log } from "viem";
import { db } from "@/lib/db";

// Extended log type that includes decoded args
type LogWithArgs = Log & {
  args?: {
    deluluId?: bigint;
    creator?: `0x${string}`;
    contentHash?: string;
    stakingDeadline?: bigint;
    resolutionDeadline?: bigint;
    creatorStake?: bigint;
  };
};

// IPFS Gateway - using public gateway with fallback
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

export interface DeluluMetadata {
  text: string; // Required: The content of the Delulu
  username?: string;
  pfpUrl?: string;
  createdAt?: string;
  gatekeeper?: {
    enabled: boolean;
    type?: string;
    value?: string;
    label?: string;
  };
  bgImageUrl?: string;
}

/**
 * Fetch metadata from IPFS with retry logic and validation
 */
async function fetchIPFSMetadata(
  contentHash: string,
  maxRetries = 3
): Promise<DeluluMetadata | null> {
  let lastError: Error | null = null;

  for (const gateway of IPFS_GATEWAYS) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const url = `${gateway}${contentHash}`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

        const response = await fetch(url, {
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();

        // Validate that required fields exist
        if (!data || typeof data.text !== "string" || data.text.trim() === "") {
          console.warn(
            `[ProcessLog] Invalid IPFS metadata structure for hash ${contentHash}. Missing 'text' field.`
          );
          return null;
        }

        return data as DeluluMetadata;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        if (attempt < maxRetries) {
          // Wait before retry (exponential backoff)
          await new Promise((r) => setTimeout(r, 1000 * attempt));
        }
      }
    }
  }

  console.warn(
    `[ProcessLog] Failed to fetch IPFS metadata for ${contentHash}:`,
    lastError?.message
  );
  return null;
}

/**
 * Process delulu creation data
 * This function handles IPFS fetching and database persistence
 */
export async function processDeluluCreated(
  data: {
    deluluId: bigint;
    creator: `0x${string}`;
    contentHash: string;
    stakingDeadline: bigint;
    resolutionDeadline: bigint;
    creatorStake?: bigint;
    txHash: string;
  }
) {
  try {
    const {
      deluluId: onChainId,
      creator: creatorAddress,
      contentHash,
      stakingDeadline,
      resolutionDeadline,
      creatorStake,
      txHash,
    } = data;

    if (!onChainId || !creatorAddress || !contentHash) {
      throw new Error("Missing required fields");
    }

    // Idempotency check: Skip if already exists
    const existing = await db.delulu.findUnique({
      where: { onChainId },
    });

    if (existing) {
      console.log(`[ProcessLog] Delulu ${onChainId} already exists, skipping`);
      return { success: true, skipped: true, onChainId: onChainId.toString() };
    }

    // Fetch IPFS metadata
    const metadata = await fetchIPFSMetadata(contentHash);

    // Handle invalid IPFS data gracefully
    if (!metadata) {
      throw new Error(
        `Failed to fetch or validate IPFS metadata for hash ${contentHash}`
      );
    }

    // Use transaction for atomicity
    await db.$transaction(async (tx: typeof db) => {
      // Upsert user (creator)
      const user = await tx.user.upsert({
        where: { address: creatorAddress.toLowerCase() },
        update: {}, // If exists, do nothing
        create: {
          address: creatorAddress.toLowerCase(),
          username: metadata.username || undefined,
          pfpUrl: metadata.pfpUrl || undefined,
        },
      });

      // Create delulu record
      const stakingDeadlineDate = new Date(Number(stakingDeadline) * 1000);
      const resolutionDeadlineDate = new Date(Number(resolutionDeadline) * 1000);

      const delulu = await tx.delulu.create({
        data: {
          onChainId,
          contentHash,
          content: metadata.text,
          creatorId: user.id,
          creatorAddress: creatorAddress.toLowerCase(),
          stakingDeadline: stakingDeadlineDate,
          resolutionDeadline: resolutionDeadlineDate,
          gatekeeperEnabled: metadata.gatekeeper?.enabled || false,
          gatekeeperType: metadata.gatekeeper?.type || null,
          gatekeeperValue: metadata.gatekeeper?.value || null,
          gatekeeperLabel: metadata.gatekeeper?.label || null,
          bgImageUrl: metadata.bgImageUrl || null,
        },
      });

      // Create initial stake if creatorStake > 0
      if (creatorStake && creatorStake > 0n) {
        const stakeAmount = Number(creatorStake) / 1e18; // Convert from wei

        await tx.stake.create({
          data: {
            userId: user.id,
            deluluId: delulu.id,
            amount: stakeAmount,
            side: true, // Creator is always a believer
            txHash: txHash,
          },
        });

        // Update delulu aggregated stats
        await tx.delulu.update({
          where: { id: delulu.id },
          data: {
            totalBelieverStake: stakeAmount,
          },
        });
      }
    });

    console.log(`[ProcessLog] Successfully processed Delulu ${onChainId}`);
    return {
      success: true,
      skipped: false,
      onChainId: onChainId.toString(),
    };
  } catch (error) {
    console.error(`[ProcessLog] Error processing log:`, error);
    throw error;
  }
}


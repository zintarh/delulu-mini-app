import { NextRequest, NextResponse } from "next/server";
import { createPublicClient, http } from "viem";
import { celo, celoSepolia } from "viem/chains";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { processDeluluCreated } from "@/lib/indexer/process-log";

export const dynamic = "force-dynamic";

/**
 * GET handler for testing the route
 */
export async function GET() {
  return NextResponse.json(
    { message: "Sync transaction endpoint is active. Use POST with txHash and deluluId." },
    { status: 200 }
  );
}

/**
 * Sync API endpoint for processing delulu creation
 * Called by the frontend after a successful blockchain transaction
 * Uses deluluId directly instead of parsing events
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body with error handling
    let body;
    try {
      body = await request.json();
    } catch (jsonError) {
      return NextResponse.json(
        { error: "Invalid JSON in request body" },
        { status: 400 }
      );
    }

    const { txHash, deluluId } = body;

    // Input validation
    if (!txHash || typeof txHash !== "string") {
      return NextResponse.json(
        { error: "txHash is required and must be a string" },
        { status: 400 }
      );
    }

    // Validate txHash format (should be hex string starting with 0x)
    if (!/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
      return NextResponse.json(
        { error: "Invalid txHash format" },
        { status: 400 }
      );
    }

    // Validate deluluId
    if (!deluluId || (typeof deluluId !== "string" && typeof deluluId !== "number")) {
      return NextResponse.json(
        { error: "deluluId is required and must be a string or number" },
        { status: 400 }
      );
    }

    const deluluIdBigInt = BigInt(deluluId);
    if (deluluIdBigInt <= 0n) {
      return NextResponse.json(
        { error: "deluluId must be greater than 0" },
        { status: 400 }
      );
    }

    // Determine chain based on environment
    const isProduction =
      process.env.NODE_ENV === "production" ||
      process.env.NEXT_PUBLIC_APP_ENV === "production";
    const chain = isProduction ? celo : celoSepolia;

    // Require NEXT_PUBLIC_RPC_URL to be set and valid
    const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL;
    if (!rpcUrl) {
      return NextResponse.json(
        { error: "NEXT_PUBLIC_RPC_URL environment variable is required" },
        { status: 500 }
      );
    }

    // Validate RPC URL format
    try {
      new URL(rpcUrl);
    } catch (urlError) {
      return NextResponse.json(
        { error: "Invalid RPC URL format" },
        { status: 500 }
      );
    }

    // Initialize Viem client
    const publicClient = createPublicClient({
      chain,
      transport: http(rpcUrl, {
        timeout: 30000, // 30s timeout
      }),
    });

    // Fetch transaction receipt to get block number and verify transaction exists
    let receipt;
    try {
      receipt = await publicClient.getTransactionReceipt({
        hash: txHash as `0x${string}`,
      });
    } catch (rpcError) {
      console.error("[Sync API] RPC error fetching receipt:", rpcError);
      const errorMessage = rpcError instanceof Error ? rpcError.message : "RPC error";
      
      // Check if it's a timeout or network error
      if (errorMessage.includes("timeout") || errorMessage.includes("ECONNREFUSED")) {
        return NextResponse.json(
          { error: "RPC connection timeout. Please try again." },
          { status: 503 }
        );
      }
      
      // Check if transaction not found
      if (errorMessage.includes("not found") || errorMessage.includes("does not exist")) {
        return NextResponse.json(
          { error: "Transaction receipt not found" },
          { status: 404 }
        );
      }
      
      throw rpcError; // Re-throw for general catch
    }

    if (!receipt) {
      return NextResponse.json(
        { error: "Transaction receipt not found" },
        { status: 404 }
      );
    }

    console.log(`[Sync API] Processing sync for txHash: ${txHash}, deluluId: ${deluluIdBigInt.toString()}`);

    // Read the delulu data from contract at the transaction's block number
    let deluluData;
    try {
      deluluData = await publicClient.readContract({
        address: DELULU_CONTRACT_ADDRESS,
        abi: DELULU_ABI,
        functionName: "getDelulu",
        args: [deluluIdBigInt],
        blockNumber: receipt.blockNumber,
      }) as {
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
      };
    } catch (readError) {
      console.error("[Sync API] Error reading delulu from contract:", readError);
      const errorMessage = readError instanceof Error ? readError.message : "Unknown error";
      
      if (errorMessage.includes("not found") || errorMessage.includes("DeluluNotFound")) {
        return NextResponse.json(
          { error: `Delulu with ID ${deluluIdBigInt.toString()} not found on-chain` },
          { status: 404 }
        );
      }
      
      return NextResponse.json(
        { error: "Failed to read delulu data from contract" },
        { status: 500 }
      );
    }

    // Verify the delulu ID matches
    if (deluluData.id !== deluluIdBigInt) {
      return NextResponse.json(
        { error: `Delulu ID mismatch: expected ${deluluIdBigInt.toString()}, got ${deluluData.id.toString()}` },
        { status: 400 }
      );
    }

    // Verify this delulu was created in this transaction
    // Check if the transaction's from address matches the creator
    let tx;
    try {
      tx = await publicClient.getTransaction({ hash: txHash as `0x${string}` });
    } catch (txError) {
      console.error("[Sync API] Error fetching transaction:", txError);
      return NextResponse.json(
        { error: "Failed to fetch transaction details" },
        { status: 500 }
      );
    }

    if (tx.from.toLowerCase() !== deluluData.creator.toLowerCase()) {
      return NextResponse.json(
        { error: "Transaction creator doesn't match delulu creator" },
        { status: 400 }
      );
    }

    // Process delulu creation with error categorization
    // We'll use the creator's initial stake (totalBelieverStake at creation)
    const creatorStake = deluluData.totalBelieverStake;

    let result;
    try {
      result = await processDeluluCreated({
        deluluId: deluluData.id,
        creator: deluluData.creator,
        contentHash: deluluData.contentHash,
        stakingDeadline: deluluData.stakingDeadline,
        resolutionDeadline: deluluData.resolutionDeadline,
        creatorStake: creatorStake,
        txHash: receipt.transactionHash,
      });
    } catch (processError) {
      console.error("[Sync API] Error processing log:", processError);
      
      const errorMessage = processError instanceof Error ? processError.message : "Unknown error";
            if (errorMessage.includes("Unique constraint") || errorMessage.includes("duplicate")) {
        return NextResponse.json(
          { error: "Delulu already exists in database" },
          { status: 409 }
        );
      }
      
      // IPFS errors
      if (errorMessage.includes("IPFS") || errorMessage.includes("fetch")) {
        return NextResponse.json(
          { error: "Failed to fetch IPFS metadata" },
          { status: 502 }
        );
      }
      
      // Database connection errors
      if (errorMessage.includes("connection") || errorMessage.includes("timeout")) {
        return NextResponse.json(
          { error: "Database connection error" },
          { status: 503 }
        );
      }
      
      // Re-throw for general catch
      throw processError;
    }

    if (result.skipped) {
      return NextResponse.json(
        {
          success: true,
          message: "Delulu already exists in database",
          onChainId: result.onChainId,
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: "Delulu synced successfully",
        onChainId: result.onChainId,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error("[Sync API] Error syncing transaction:", error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 }
    );
  }
}


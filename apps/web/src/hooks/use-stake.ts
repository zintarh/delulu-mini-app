import { useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useChainId } from "wagmi";
import { parseUnits, decodeErrorResult } from "viem";
import { getDeluluContractAddress, isGoodDollarToken, isGoodDollarSupported } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";

export function useStake() {
  const chainId = useChainId();
  const { writeContract, data: hash, isPending, error } = useWriteContract();

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const stake = async (
    deluluId: number,
    amount: number,
    isBeliever: boolean,
    tokenAddress?: string
  ) => {
    if (isNaN(deluluId) || deluluId <= 0) {
      throw new Error("Invalid delulu ID");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Stake amount must be greater than 0");
    }

    // Validate: G$ is only supported on mainnet
    if (tokenAddress && isGoodDollarToken(tokenAddress) && !isGoodDollarSupported(chainId)) {
      throw new Error("G$ (GoodDollar) is only available on Celo Mainnet. Please switch to mainnet to stake with G$.");
    }

    try {
      const amountWei = parseUnits(amount.toString(), 18);
      const minPayout = 0n;
      const contractAddress = getDeluluContractAddress(chainId);

      writeContract({
        address: contractAddress,
        abi: DELULU_ABI,
        functionName: "stakeOnDelulu",
        args: [BigInt(deluluId), isBeliever, amountWei, minPayout],
      });
    } catch (err) {
      handleStakeError(err);
    }
  };

  return {
    stake,
    hash,
    isPending,
    isConfirming,
    isSuccess,
    error: error || receiptError,
  };
}

function handleStakeError(error: unknown): never {
  // Log full error for debugging
  console.error("[useStake] Full error object:", error);
  
  const err = error as {
    message?: string;
    code?: number;
    shortMessage?: string;
    data?: string;
    cause?: any;
    name?: string;
  };

  const msg = (err?.message?.toLowerCase() ?? "").trim();
  const shortMsg = (err?.shortMessage?.toLowerCase() ?? "").trim();
  const code = err?.code;
  const errorName = err?.name;

  if (
    msg.includes("user rejected") ||
    msg.includes("user denied") ||
    code === 4001
  ) {
    throw new Error("Transaction was cancelled");
  }

  if (
    code === -32019 ||
    msg.includes("out of range") ||
    msg.includes("block is out of range")
  ) {
    throw new Error(
      "Network synchronization issue. Please wait a moment and try again."
    );
  }

  let errorData: string | undefined;
  const errorAny = err as Record<string, unknown>;

  // Try to extract error data from various locations
  if (typeof errorAny?.data === "string" && (errorAny.data as string).startsWith("0x")) {
    errorData = errorAny.data as string;
  } else if (
    typeof (errorAny?.cause as Record<string, unknown>)?.data === "string" &&
    ((errorAny.cause as Record<string, unknown>).data as string).startsWith("0x")
  ) {
    errorData = (errorAny.cause as Record<string, unknown>).data as string;
  } else if (
    typeof (errorAny?.cause as Record<string, unknown>)?.cause === "object" &&
    typeof ((errorAny.cause as Record<string, unknown>).cause as Record<string, unknown>)?.data === "string"
  ) {
    const nestedCause = (errorAny.cause as Record<string, unknown>).cause as Record<string, unknown>;
    if (typeof nestedCause.data === "string" && nestedCause.data.startsWith("0x")) {
      errorData = nestedCause.data as string;
    }
  }

  // Try to extract from deeper nested structures (viem simulation errors)
  const extractErrorData = (obj: any, depth = 0): string | undefined => {
    if (depth > 5) return undefined; // Prevent infinite recursion
    if (!obj || typeof obj !== "object") return undefined;
    
    if (typeof obj.data === "string" && obj.data.startsWith("0x")) {
      return obj.data;
    }
    
    if (obj.cause) {
      const fromCause = extractErrorData(obj.cause, depth + 1);
      if (fromCause) return fromCause;
    }
    
    // Check all properties
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        const found = extractErrorData(obj[key], depth + 1);
        if (found) return found;
      }
    }
    
    return undefined;
  };

  if (!errorData) {
    errorData = extractErrorData(errorAny);
  }

  if (errorData) {
    try {
      const decoded = decodeErrorResult({
        abi: DELULU_ABI,
        data: errorData as `0x${string}`,
      });

      const errorMessages: Record<string, string> = {
        DeluluNotFound: "Delulu not found. Please refresh and try again.",
        StakingIsClosed: "Staking deadline has passed",
        AlreadyResolved: "Delulu already resolved or cancelled",
        MarketCancelled: "This delulu has been cancelled",
        StakeTooSmall: "Stake amount is too small (minimum 1 token)",
        StakeTooLarge: "Stake amount exceeds maximum limit",
        StakeLimitExceeded:
          "You've reached the maximum stake limit for this delulu (100,000 tokens)",
        SlippageTooHigh:
          "Slippage protection: payout would be less than expected",
        CannotSwitchSides: "You've already staked on the opposite side. You cannot switch sides.",
        SafeERC20FailedOperation:
          "Token transfer failed. Please check your balance and approval.",
      };

      const errorMessage =
        errorMessages[decoded.errorName] ||
        `Transaction failed: ${decoded.errorName}`;
      throw new Error(errorMessage);
    } catch (decodeErr) {
      if (decodeErr instanceof Error && decodeErr.message !== "Transaction failed") {
        throw decodeErr;
      }
      // If decoding fails, fall through to generic error handling
    }
  }

  // Extract error name from cause message (format: "Error: ErrorName()")
  let extractedErrorName: string | undefined;
  if (err?.cause) {
    const causeMessage = (err.cause as any)?.message || "";
    const causeMatch = causeMessage.match(/Error:\s*(\w+)\(\)/);
    if (causeMatch && causeMatch[1]) {
      extractedErrorName = causeMatch[1];
    }
  }

  // Check if error name or message contains known error names
  const allMessages = `${msg} ${shortMsg} ${errorName || ""} ${extractedErrorName || ""}`.toLowerCase();
  
  // Check for specific error names in the message
  const errorNameMap: Record<string, string> = {
    "delulunotfound": "Delulu not found. Please refresh and try again.",
    "stakingisclosed": "Staking deadline has passed",
    "alreadyresolved": "Delulu already resolved or cancelled",
    "marketcancelled": "This delulu has been cancelled",
    "staketoosmall": "Stake amount is too small (minimum 1 token)",
    "staketoolarge": "Stake amount exceeds maximum limit",
    "stakelimitexceeded": "You've reached the maximum stake limit for this delulu (100,000 tokens)",
    "slippagetoothigh": "Slippage protection: payout would be less than expected",
    "cannotswitchsides": "You've already staked on the opposite side. You cannot switch sides.",
    "safeerc20failedoperation": "Token transfer failed. Please check your balance and approval.",
  };

  // First check extracted error name (most reliable)
  if (extractedErrorName) {
    const errorKey = extractedErrorName.toLowerCase();
    if (errorNameMap[errorKey]) {
      throw new Error(errorNameMap[errorKey]);
    }
  }

  // Then check all messages
  for (const [key, message] of Object.entries(errorNameMap)) {
    if (allMessages.includes(key)) {
      throw new Error(message);
    }
  }

  const combinedMsg = `${msg} ${shortMsg}`.toLowerCase();
  if (
    combinedMsg.includes("execution reverted") ||
    combinedMsg.includes("revert")
  ) {
    if (combinedMsg.includes("deadline") || combinedMsg.includes("stakingisclosed"))
      throw new Error("Staking deadline has passed");
    if (combinedMsg.includes("resolved") || combinedMsg.includes("alreadyresolved"))
      throw new Error("Delulu already resolved or cancelled");
    if (combinedMsg.includes("cancelled") || combinedMsg.includes("marketcancelled"))
      throw new Error("This delulu has been cancelled");
    if (
      combinedMsg.includes("insufficient") ||
      combinedMsg.includes("balance") ||
      combinedMsg.includes("safeerc20")
    ) {
      throw new Error(
        "Insufficient balance or approval. Please check your token balance and ensure you've approved the contract."
      );
    }
    if (combinedMsg.includes("allowance") || combinedMsg.includes("approve")) {
      throw new Error(
        "Token approval required. Please approve the contract to spend your tokens."
      );
    }
    if (combinedMsg.includes("cannotswitchsides") || combinedMsg.includes("switch sides")) {
      throw new Error("You've already staked on the opposite side. You cannot switch sides.");
    }
    // Log the full error message for debugging
    console.error("[useStake] Generic revert error:", {
      message: err?.message,
      shortMessage: err?.shortMessage,
      name: err?.name,
      code: err?.code,
      data: err?.data,
      cause: err?.cause,
    });
    throw new Error(
      "Transaction failed. Please check your balance, approval, and try again."
    );
  }

  throw new Error(err?.shortMessage || err?.message || "Transaction failed");
}

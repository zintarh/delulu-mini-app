import {
  useWaitForTransactionReceipt,
  useChainId,
  useWriteContract,
} from "wagmi";
import { useState } from "react";
import { createWalletClient, custom, decodeErrorResult } from "viem";
import { celo } from "wagmi/chains";
import { getDeluluContractAddress } from "@/lib/constant";
import { DELULU_ABI } from "@/lib/abi";
import { getWeb3AuthProvider } from "@/lib/web3auth-bridge";

export function useSetProfile() {
  const chainId = useChainId();
  const { writeContractAsync } = useWriteContract();
  const [hash, setHash] = useState<`0x${string}` | undefined>(undefined);
  const [isPending, setIsPending] = useState(false);
  const [writeError, setWriteError] = useState<Error | null>(null);

  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash });

  const setProfile = async (username: string) => {
    if (!username || username.trim().length === 0) {
      throw new Error("Username is required");
    }
    try {
      setIsPending(true);
      setWriteError(null);

      const w3aProvider = getWeb3AuthProvider();

      let txHash: `0x${string}`;

      if (w3aProvider) {
        // Web3Auth path — wagmi has no wallet client for this user,
        // so write directly via viem using the Web3Auth EIP-1193 provider.
        const walletClient = createWalletClient({
          chain: celo,
          transport: custom(w3aProvider),
        });
        const [account] = await walletClient.getAddresses();
        txHash = await walletClient.writeContract({
          address: getDeluluContractAddress(chainId),
          abi: DELULU_ABI,
          functionName: "setProfile",
          args: [username.trim()],
          account,
          chain: celo,
        });
      } else {
        // Privy / Farcaster path — wagmi connector is connected normally.
        txHash = await writeContractAsync({
          address: getDeluluContractAddress(chainId),
          abi: DELULU_ABI,
          functionName: "setProfile",
          args: [username.trim()],
        });
      }

      setHash(txHash);
    } catch (err) {
      const formatted = formatErrorForDisplay(err);
      setWriteError(formatted);
      throw formatted;
    } finally {
      setIsPending(false);
    }
  };

  const formattedError = writeError || receiptError;
  const displayError = formattedError ? formatErrorForDisplay(formattedError) : null;

  return {
    setProfile,
    hash,
    isPending: isPending || isConfirming,
    isSuccess,
    isError: !!displayError,
    error: displayError,
    isWalletPending: isPending,
    isConfirming,
  };
}

function formatErrorForDisplay(error: unknown): Error {
  const err = error as { message?: string; data?: unknown };

  if (err?.data) {
    try {
      const decoded = decodeErrorResult({ abi: DELULU_ABI, data: err.data as `0x${string}` });
      const errorMessage = decoded.args?.[0];
      const message = typeof errorMessage === "string" ? errorMessage : decoded.errorName || "Transaction failed";
      return new Error(message);
    } catch {}
  }

  if (err?.message) {
    const rawMessage = err.message;
    const message = rawMessage.toLowerCase();

    if (message.includes("usernamealreadytaken")) {
      return new Error("This username is already taken");
    }
    if (message.includes("usernametooshort")) {
      return new Error("Username must be at least 3 characters");
    }
    if (message.includes("usernametoolong")) {
      return new Error("Username must be 16 characters or less");
    }
    if (message.includes("usernameinvalid")) {
      return new Error("Username can only contain letters, numbers, and underscores");
    }
    if (
      message.includes("insufficient funds") ||
      message.includes("fee payer balance too low") ||
      message.includes("gas * price + value")
    ) {
      return new Error("Your wallet doesn’t have enough CELO for gas. Please top up and try again.");
    }
    if (
      message.includes("user rejected") ||
      message.includes("transaction was cancelled") ||
      message.includes("request rejected")
    ) {
      return new Error("Transaction was cancelled.");
    }
    if (
      message.includes("failed to sign message") ||
      message.includes("transaction signature")
    ) {
      return new Error("We couldn’t sign this transaction. Please try again.");
    }
    if (message.includes("popup window is blocked")) {
      return new Error("Your browser blocked the wallet popup. Allow popups and try again.");
    }

    // Never leak raw stack-heavy provider errors to end users.
    return new Error("We couldn’t update your profile right now. Please try again.");
  }

  return new Error("An unknown error occurred");
}

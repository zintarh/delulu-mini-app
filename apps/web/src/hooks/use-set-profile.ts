"use client";

import {
  useWaitForTransactionReceipt,
  useChainId,
  useWriteContract,
} from "wagmi";
import { useState } from "react";
import { createPublicClient, createWalletClient, custom, decodeErrorResult, http } from "viem";
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
    const trimmed = username.trim();

    try {
      setIsPending(true);
      setWriteError(null);

      // Pre-check: is the username already taken? Doing this via a direct
      // public-client read avoids opening the wallet popup only to get a
      // revert, which causes MetaMask to show a scary "Network fee: Unavailable" warning.
      const publicClient = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });
      const contractAddress = getDeluluContractAddress(chainId);
      try {
        const taken = await publicClient.readContract({
          address: contractAddress,
          abi: DELULU_ABI,
          functionName: "isUsernameTaken",
          args: [trimmed],
        });
        if (taken) throw new Error("This username is already taken. Please choose another.");
      } catch (preCheckErr) {
        // Re-throw only known pre-check errors; ignore RPC failures so the tx
        // still attempts and the contract itself can return the real revert reason.
        if (preCheckErr instanceof Error && preCheckErr.message.includes("already taken")) {
          throw preCheckErr;
        }
      }

      const w3aProvider = getWeb3AuthProvider();
      let txHash: `0x${string}`;

      if (w3aProvider) {
        // Web3Auth / Privy path — wagmi has no wallet client for this user,
        // so write directly via viem using the EIP-1193 provider from the bridge.
        const walletClient = createWalletClient({
          chain: celo,
          transport: custom(w3aProvider),
        });
        const [account] = await walletClient.getAddresses();
        txHash = await walletClient.writeContract({
          address: contractAddress,
          abi: DELULU_ABI,
          functionName: "setProfile",
          args: [trimmed],
          account,
          chain: celo,
        });
      } else {
        // Wagmi connector path (MetaMask / injected wallet).
        txHash = await writeContractAsync({
          address: contractAddress,
          abi: DELULU_ABI,
          functionName: "setProfile",
          args: [trimmed],
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
  const err = error as { message?: string; data?: unknown; cause?: unknown };

  // 1. Try to decode a typed contract revert (e.g. UsernameTaken, UsernameTooShort…)
  const revertData =
    (err?.data as string | undefined) ??
    ((err?.cause as { data?: string } | undefined)?.data);
  if (revertData && revertData !== "0x") {
    try {
      const decoded = decodeErrorResult({ abi: DELULU_ABI, data: revertData as `0x${string}` });
      const errorMessage = decoded.args?.[0];
      const message = typeof errorMessage === "string" ? errorMessage : decoded.errorName || "Transaction failed";
      return new Error(message);
    } catch {}
  }

  // 2. Walk the full message + cause chain so nested viem errors are caught
  const rawMessage = [
    err?.message ?? "",
    (err?.cause as { message?: string } | undefined)?.message ?? "",
  ].join(" ").toLowerCase();

  if (!rawMessage.trim()) return new Error("An unknown error occurred");

  // Username errors (from error name in revert message, e.g. ContractFunctionExecutionError)
  if (rawMessage.includes("usernamealreadytaken") || rawMessage.includes("already taken")) {
    return new Error("This username is already taken. Please choose another.");
  }
  if (rawMessage.includes("usernametooshort")) {
    return new Error("Username must be at least 3 characters.");
  }
  if (rawMessage.includes("usernametoolong")) {
    return new Error("Username must be 16 characters or less.");
  }
  if (rawMessage.includes("usernameinvalid")) {
    return new Error("Username can only contain letters, numbers, and underscores.");
  }

  // Insufficient gas / funds — covers MetaMask, viem, Celo node messages
  if (
    rawMessage.includes("insufficient funds") ||
    rawMessage.includes("fee payer balance too low") ||
    rawMessage.includes("gas * price + value") ||
    rawMessage.includes("gas required exceeds allowance") ||
    rawMessage.includes("exceeds allowance") ||
    rawMessage.includes("balance is insufficient") ||
    rawMessage.includes("not enough celo") ||
    rawMessage.includes("intrinsic gas too low") ||
    rawMessage.includes("out of gas")
  ) {
    return new Error("Not enough CELO for gas fees. Please top up your wallet and try again.");
  }

  // User / wallet cancelled
  if (
    rawMessage.includes("user rejected") ||
    rawMessage.includes("transaction was cancelled") ||
    rawMessage.includes("request rejected") ||
    rawMessage.includes("user denied") ||
    rawMessage.includes("rejected the request")
  ) {
    return new Error("Transaction cancelled.");
  }

  // Signing failures
  if (
    rawMessage.includes("failed to sign") ||
    rawMessage.includes("transaction signature")
  ) {
    return new Error("We couldn't sign this transaction. Please try again.");
  }

  // Popup blocked
  if (rawMessage.includes("popup window is blocked")) {
    return new Error("Your browser blocked the wallet popup. Allow popups and try again.");
  }

  // Generic fallback — never leak raw viem/provider stack traces to users
  return new Error("We couldn't update your profile right now. Please try again.");
}

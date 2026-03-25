"use client";

import { useState } from "react";
import { useAccount, useBalance } from "wagmi";
import { CELO_MAINNET_ID } from "@/lib/constant";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
  ModalDescription,
  ModalFooter,
} from "@/components/ui/modal";

interface FaucetModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function FaucetModal({ open, onOpenChange }: FaucetModalProps) {
  const { address, isConnected } = useAccount();
  const [isClaiming, setIsClaiming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data: celoBalance, refetch } = useBalance({
    address,
    chainId: CELO_MAINNET_ID,
    query: { enabled: !!address },
  });

  const formattedBalance =
    celoBalance && Number(celoBalance.formatted) > 0
      ? Number(celoBalance.formatted).toFixed(4)
      : "0";

  const handleClaim = async () => {
    if (!address || !isConnected || isClaiming) return;
    setIsClaiming(true);
    setMessage(null);
    setError(null);

    try {
      const res = await fetch("/api/faucet", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error ?? "Unable to claim gas right now.");
      } else {
        setMessage("Gas sent! It may take a few seconds to show in your wallet.");
        await refetch();
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsClaiming(false);
    }
  };

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent className="max-w-md">
        <ModalHeader>
          <ModalTitle>Gas faucet</ModalTitle>
          <ModalDescription>
            Get a bit of CELO on mainnet to cover gas for transactions. Available for wallets with
            less than 1 CELO.
          </ModalDescription>
        </ModalHeader>

        <div className="mt-4 space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Account</span>
            <span className="font-mono text-xs">
              {address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Not connected"}
            </span>
          </div>
         

          {!isConnected && (
            <p className="text-[11px] text-destructive">
              Login with Privy or connect a wallet to request gas.
            </p>
          )}

          {message && (
            <div className="text-[11px] rounded-md border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-emerald-300">
              {message}
            </div>
          )}
          {error && (
            <div className="text-[11px] rounded-md border border-destructive/60 bg-destructive/10 px-3 py-2 text-destructive">
              {error}
            </div>
          )}
        </div>

        <ModalFooter>
          <button
            type="button"
            onClick={handleClaim}
            disabled={!isConnected || isClaiming}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 rounded-md border-2 border-delulu-charcoal px-4 py-3 text-sm font-bold shadow-[3px_3px_0px_0px_#1A1A1A]",
              "bg-delulu-yellow-reserved text-delulu-charcoal hover:bg-delulu-yellow-reserved/90",
              (!isConnected || isClaiming) && "opacity-60 cursor-not-allowed"
            )}
          >
            {isClaiming && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>{isClaiming ? "Requesting gas..." : "Claim 0.05"}</span>
          </button>

          <p className="text-[10px] text-muted-foreground leading-relaxed text-center">
            Limit: once every 24 hours per address. This faucet only sends enough CELO for a
            few transactions and is intended for users with little or no gas.
          </p>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}


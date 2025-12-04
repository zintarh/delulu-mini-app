"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectedAccount } from "./connected-account";

interface ConnectWalletProps {
  className?: string;
}

function ConnectWalletComponent({ className }: ConnectWalletProps) {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);

  // Find the Farcaster connector
  const frameConnector = connectors.find(
    (connector) => connector.id === "farcaster"
  );

  // If connected, show the account UI
  if (isConnected) {
    return <ConnectedAccount className={className} />;
  }

  const isLoading = isPending;
  const handleConnect = () => {
    if (frameConnector && !isLoading && !hasAttemptedConnect) {
      setHasAttemptedConnect(true);
      connect({ connector: frameConnector });
    }
  };

  // Show connect button (no auto-connect)
  return (
    <button
      onClick={handleConnect}
      disabled={isLoading || !frameConnector || hasAttemptedConnect}
      type="button"
      className={cn(
        "relative px-5 py-2",
        "bg-gradient-to-b from-delulu-yellow via-delulu-yellow to-[#d4af37]",
        "text-delulu-dark",
        "rounded-xl font-black text-sm",
        "border-2 border-delulu-dark",
        "shadow-[0_4px_0_0_#0a0a0a]",
        "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
        "transition-all duration-150",
        "disabled:opacity-70 disabled:shadow-[0_2px_0_0_#0a0a0a]",
        "flex items-center gap-2",
        className
      )}
    >
      {isLoading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <span>Connect</span>
      )}
    </button>
  );
}

export function ConnectWallet({ className }: ConnectWalletProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-20 h-9 animate-pulse bg-delulu-dark/10 rounded-full" />
    );
  }

  return <ConnectWalletComponent className={className} />;
}
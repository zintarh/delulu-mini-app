"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
import { useMiniApp } from "@/contexts/miniapp-context";
import { Loader2, ChevronDown, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import { ConnectedAccount } from "@/components/wallet/connected-account";

interface WalletConnectButtonProps {
  className?: string;
}

export function WalletConnectButton({ className }: WalletConnectButtonProps) {
  const [mounted, setMounted] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { context } = useMiniApp();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="w-20 h-9 animate-pulse bg-gray-800 rounded-full" />
    );
  }

  if (isConnected) {
    return <ConnectedAccount className={className} />;
  }

  // Logic:
  // 1. If we have Farcaster Context, we prioritise the Farcaster connector.
  // 2. If we are on localhost/browser (no context), we show all other connectors (MetaMask, etc).

  const isFarcasterEnv = !!context;
  const frameConnector = connectors.find((c) => c.id === "farcaster");

  // Filter out farcaster from the list for the dropdown
  const browserConnectors = connectors.filter((c) => c.id !== "farcaster");

  const handleConnect = () => {
    if (isFarcasterEnv && frameConnector) {
      connect({ connector: frameConnector });
    } else {
      // Toggle dropdown to show MetaMask/others
      setShowDropdown(!showDropdown);
    }
  };

  const isLoading = isPending;

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={handleConnect}
        disabled={isLoading || (isFarcasterEnv && !frameConnector)}
        type="button"
        className={cn(
          "relative px-5 py-2 flex items-center gap-2",
          "bg-gradient-to-b from-black via-black to-black",
          "text-delulu-dark",
          "rounded-xl font-black text-sm",
          "border-2 border-delulu-dark",
          "shadow-[0_4px_0_0_#0a0a0a]",
          "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
          "transition-all duration-150",
          "disabled:opacity-70 disabled:shadow-[0_2px_0_0_#0a0a0a]",
          className
        )}
      >
        {isLoading ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <span>{isFarcasterEnv ? "Connect" : "Connect Wallet"}</span>
            {!isFarcasterEnv && <ChevronDown className="w-4 h-4" />}
          </>
        )}
      </button>

      {/* Dropdown for Browser Testing (MetaMask, etc) */}
      {!isFarcasterEnv && showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-gray-900 border-2 border-delulu-dark rounded-xl shadow-[0_4px_0_0_#0a0a0a] z-50 overflow-hidden">
          <div className="p-2 space-y-1">
            {browserConnectors.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">
                No wallets found
              </div>
            ) : (
              browserConnectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector });
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-bold hover:bg-black/20 rounded-lg transition-colors flex items-center gap-3"
                >
                  {/* You can add icons here based on connector.id if you want */}
                  <Wallet className="w-4 h-4" />
                  {connector.name}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

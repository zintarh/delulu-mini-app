"use client";

import { useState, useEffect, useRef } from "react";
import { useAccount, useConnect } from "wagmi";
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
    return <div className="w-20 h-9 animate-pulse bg-black/80 rounded-full" />;
  }

  if (isConnected) {
    return <ConnectedAccount className={className} />;
  }

  const getConnectorLabel = (connector: (typeof connectors)[number]) => {
    if (
      connector.id === "walletConnect" ||
      connector.id.toLowerCase().includes("walletconnect")
    ) {
      return "WalletConnect";
    }
    return connector.name;
  };

  const getConnectorIcon = (connector: (typeof connectors)[number]) => {
    if (
      connector.id === "walletConnect" ||
      connector.id.toLowerCase().includes("walletconnect")
    ) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/wallet-connect.png"
          alt="WalletConnect"
          className="w-4 h-4 rounded-full object-cover"
        />
      );
    }

    const iconUrl: string | undefined =
      (connector as Record<string, unknown>).icon as string | undefined ??
      (connector as Record<string, unknown>).iconUrl as string | undefined;

    if (iconUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt={connector.name}
          className="w-4 h-4 rounded-full object-cover"
        />
      );
    }

    return <Wallet className="w-4 h-4" />;
  };

  return (
    <div className="relative inline-block" ref={dropdownRef}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        disabled={isPending}
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
        {isPending ? (
          <Loader2 className="w-4 h-4 animate-spin" />
        ) : (
          <>
            <span>Connect Wallet</span>
            <ChevronDown className="w-4 h-4" />
          </>
        )}
      </button>

      {showDropdown && (
        <div className="absolute right-0 top-full mt-2 w-56 bg-card border-2 border-border rounded-xl shadow-neo z-50 overflow-hidden">
          <div className="p-2 space-y-1">
            {connectors.length === 0 ? (
              <div className="px-4 py-2 text-sm text-gray-500">No wallets found</div>
            ) : (
              connectors.map((connector) => (
                <button
                  key={connector.id}
                  onClick={() => {
                    connect({ connector });
                    setShowDropdown(false);
                  }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-foreground hover:bg-secondary rounded-lg transition-colors flex items-center gap-3"
                >
                  {getConnectorIcon(connector)}
                  {getConnectorLabel(connector)}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

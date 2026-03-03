"use client";

import { useEffect, useState } from "react";
import { useConnect, useAccount } from "wagmi";
import { Loader2, Wallet, AlertCircle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { ModalHeader, ModalTitle } from "@/components/ui/modal";

interface ConnectorSelectionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ConnectorSelectionSheet({
  open,
  onOpenChange,
}: ConnectorSelectionSheetProps) {
  const { connect, connectors, isPending, error, status } = useConnect();
  const { isConnected, address } = useAccount();
  const [connectingConnectorId, setConnectingConnectorId] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // Filter out the Farcaster connector from this local wallet selection UI
  const nonFarcasterConnectors = connectors.filter(
    (connector) => connector.id !== "farcaster"
  );

  // Separate injected vs non-injected connectors
  const injectedConnectors = nonFarcasterConnectors.filter(
    (connector) => connector.type === "injected"
  );
  const nonInjectedConnectors = nonFarcasterConnectors.filter(
    (connector) => connector.type !== "injected"
  );

  // If we have specific injected wallets (MetaMask, Coinbase, etc.),
  // hide generic "Injected"/"Browser Wallet"/"Brave" style entries.
  const GENERIC_INJECTED_NAMES = [
    "Injected",
    "Browser Wallet",
    "Brave Wallet",
    "Brave",
  ];

  const hasSpecificInjectedWallets = injectedConnectors.some(
    (connector) => !GENERIC_INJECTED_NAMES.includes(connector.name)
  );

  const filteredInjectedConnectors = hasSpecificInjectedWallets
    ? injectedConnectors.filter(
      (connector) => !GENERIC_INJECTED_NAMES.includes(connector.name)
    )
    : injectedConnectors;

  const availableConnectors = [
    ...filteredInjectedConnectors,
    ...nonInjectedConnectors,
  ];

  useEffect(() => {
    if (open && process.env.NODE_ENV === 'development') {
    }
  }, [open, availableConnectors]);



  useEffect(() => {
    if (isConnected && connectingConnectorId) {
      const timer = setTimeout(() => {
        setConnectingConnectorId(null);
        setConnectionError(null);
        onOpenChange(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [isConnected, connectingConnectorId, onOpenChange]);

  useEffect(() => {
    if (error) {
      let errorMessage = "Failed to connect wallet";
      if (error.message) {
        const errorLower = error.message.toLowerCase();
        if (errorLower.includes("user rejected") || errorLower.includes("user denied")) {
          errorMessage = "Connection cancelled";
        } else if (errorLower.includes("no provider") || errorLower.includes("not found")) {
          errorMessage = "Wallet not found. Please install a wallet extension.";
        } else if (errorLower.includes("network") || errorLower.includes("chain")) {
          errorMessage = "Network error. Please check your connection.";
        } else {
          errorMessage = error.message;
        }
      }

      setConnectionError(errorMessage);
      // Clear error after 5 seconds
      const timer = setTimeout(() => {
        setConnectionError(null);
        setConnectingConnectorId(null);
      }, 5000);
      return () => clearTimeout(timer);
    } else {
      setConnectionError(null);
    }
  }, [error]);

  // Reset state when modal closes
  useEffect(() => {
    if (!open) {
      setConnectingConnectorId(null);
      setConnectionError(null);
    }
  }, [open]);

  const handleConnect = async (connectorId: string) => {
    const connector = connectors.find((c) => c.id === connectorId);
    if (connector) {
      setConnectingConnectorId(connectorId);
      setConnectionError(null);
      try {
        await connect({ connector });
      } catch (err) {
        // Error is handled by useEffect above
      }
    }
  };

  // Log successful connection
  useEffect(() => {
    if (isConnected && connectingConnectorId && address) {
    }
  }, [isConnected, connectingConnectorId, address]);

  const getConnectorLabel = (connector: (typeof connectors)[number]) => {
    // WalletConnect: explicitly guide GoodDollar users
    if (
      connector.id === "walletConnect" ||
      connector.id.toLowerCase().includes("walletconnect")
    ) {
      return "WalletConnect";
    }

    // Injected wallets: use the specific wallet name from EIP-6963 metadata
    if (connector.type === "injected") {
      return connector.name;
    }

    return connector.name;
  };

  const getConnectorIcon = (connector: (typeof connectors)[number]) => {
    // Use custom WalletConnect logo if it's WalletConnect
    if (
      connector.id === "walletConnect" ||
      connector.id.toLowerCase().includes("walletconnect")
    ) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src="/wallet-connect.png"
          alt="WalletConnect"
          className="w-6 h-6 rounded-full object-cover"
        />
      );
    }

    const anyConnector = connector as any;
    const iconUrl: string | undefined =
      anyConnector?.icon ??
      anyConnector?.iconUrl ??
      anyConnector?.iconDark ??
      anyConnector?.iconLight;

    if (iconUrl) {
      return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={iconUrl}
          alt={connector.name}
          className="w-6 h-6 rounded-full object-cover"
        />
      );
    }

    return <Wallet className="w-5 h-5 text-delulu-charcoal" />;
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Connect Wallet"
      sheetClassName="border-t-2 border-white/20 rounded-t-3xl pb-8 bg-zinc-900 [&>button]:text-white [&>button]:bg-white/10 [&>button]:hover:bg-white/20"
      modalClassName="max-w-md"
    >
      <div className="mt-6 space-y-3 lg:mt-4">
        {/* Error Message */}
        {connectionError && (
          <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <p className="text-sm text-red-200">{connectionError}</p>
          </div>
        )}

        {/* Success Message */}
        {isConnected && connectingConnectorId && (
          <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-lg flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
            <p className="text-sm text-green-200">Wallet connected successfully!</p>
          </div>
        )}

        {availableConnectors.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-white/60 mb-2">
              No wallets available.
            </p>
            <p className="text-white/40 text-sm">
              Please install a browser wallet extension (e.g. MetaMask, Coinbase Wallet) or configure WalletConnect.
            </p>
          </div>
        ) : (
          availableConnectors.map((connector) => {
            const isConnecting = isPending && connectingConnectorId === connector.id;
            const isConnectedState = isConnected && connectingConnectorId === connector.id;

            return (
              <button
                key={connector.uid ?? connector.id}
                onClick={() => handleConnect(connector.id)}
                disabled={isPending || isConnectedState}
                className={cn(
                  "w-full py-4 px-4",
                  isConnectedState
                    ? "bg-green-500/20 border-2 border-green-500/50"
                    : "bg-delulu-yellow-reserved border-2 border-delulu-charcoal",
                  "rounded-md",
                  "shadow-[3px_3px_0px_0px_#1A1A1A]",
                  !isPending && !isConnectedState && "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_#1A1A1A]",
                  !isPending && !isConnectedState && "active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
                  "transition-all duration-100",
                  "flex items-center justify-between",
                  "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-delulu-charcoal/10 flex items-center justify-center overflow-hidden">
                    {getConnectorIcon(connector)}
                  </div>
                  <span className={cn(
                    "font-bold text-lg",
                    isConnectedState ? "text-green-200" : "text-delulu-charcoal"
                  )}>
                    {getConnectorLabel(connector)}
                  </span>
                </div>
                {isConnecting && (
                  <Loader2 className="w-5 h-5 animate-spin text-delulu-charcoal" />
                )}
                {isConnectedState && (
                  <CheckCircle2 className="w-5 h-5 text-green-400" />
                )}
              </button>
            );
          })
        )}
      </div>
    </ResponsiveSheet>
  );
}


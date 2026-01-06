"use client";

import { useConnect } from "wagmi";
import { Loader2, Wallet } from "lucide-react";
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
  const { connect, connectors, isPending } = useConnect();

  const handleConnect = (connectorId: string) => {
    const connector = connectors.find((c) => c.id === connectorId);
    if (connector) {
      connect({ connector });
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    }
  };

  const availableConnectors = connectors.filter(
    (connector) => connector.id !== "farcaster"
  );

  const getConnectorName = (id: string) => {
    if (id === "io.metamask" || id.includes("metamask")) return "MetaMask";
    if (id === "injected" || id.includes("injected")) return "Browser Wallet";
    if (id.includes("walletconnect")) return "WalletConnect";
    return id.charAt(0).toUpperCase() + id.slice(1);
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
          {availableConnectors.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-white/60">
                No wallets available. Please install a wallet extension.
              </p>
            </div>
          ) : (
            availableConnectors.map((connector) => (
              <button
                key={connector.id}
                onClick={() => handleConnect(connector.id)}
                disabled={isPending}
                className={cn(
                  "w-full py-4 px-4",
                  "bg-black rounded-xl",
                  "border-2 border-delulu-dark",
                  "shadow-[0_4px_0_0_#0a0a0a]",
                  "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                  "transition-all duration-150",
                  "flex items-center justify-between",
                  "hover:bg-black",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-black/80 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-black text-white">
                    {getConnectorName(connector.name || connector.id)}
                  </span>
                </div>
                {isPending && (
                  <Loader2 className="w-5 h-5 animate-spin text-white" />
                )}
              </button>
            ))
          )}
      </div>
    </ResponsiveSheet>
  );
}


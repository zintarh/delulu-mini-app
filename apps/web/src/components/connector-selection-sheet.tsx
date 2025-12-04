"use client";

import { useConnect } from "wagmi";
import { Loader2, Wallet } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

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
      // Close sheet after connecting
      setTimeout(() => {
        onOpenChange(false);
      }, 500);
    }
  };

  // Filter out Farcaster connector for local testing
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="bg-delulu-yellow border-t-2 border-delulu-dark/20 rounded-t-3xl pb-8"
      >
        <SheetHeader>
          <SheetTitle className="text-xl font-black text-delulu-dark text-left">
            Connect Wallet
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-3">
          {availableConnectors.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-delulu-dark/60">
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
                  "bg-white rounded-xl",
                  "border-2 border-delulu-dark",
                  "shadow-[0_4px_0_0_#0a0a0a]",
                  "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
                  "transition-all duration-150",
                  "flex items-center justify-between",
                  "hover:bg-delulu-dark/5",
                  "disabled:opacity-50 disabled:cursor-not-allowed"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-delulu-dark/10 flex items-center justify-center">
                    <Wallet className="w-5 h-5 text-delulu-dark" />
                  </div>
                  <span className="font-black text-delulu-dark">
                    {getConnectorName(connector.name || connector.id)}
                  </span>
                </div>
                {isPending && (
                  <Loader2 className="w-5 h-5 animate-spin text-delulu-dark" />
                )}
              </button>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}


"use client";

import { useState, useEffect } from "react";
import { useAccount, useDisconnect, useBalance } from "wagmi";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/stores/useUserStore";
import { SheetTrigger } from "@/components/ui/sheet";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { ModalHeader, ModalTitle } from "@/components/ui/modal";

interface ConnectedAccountProps {
  className?: string;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
  fid?: string;
}

export function ConnectedAccount({
  className,
  username,
  displayName,
  pfpUrl,
  fid,
}: ConnectedAccountProps) {
  const [mounted, setMounted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showSheet, setShowSheet] = useState(false);

  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const { data: balance } = useBalance({ address });
  const { logout } = useUserStore();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || !isConnected || !address) {
    return null;
  }

  const truncatedAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;
  const formattedBalance = balance
    ? parseFloat(balance.formatted).toFixed(2)
    : "0.00";
  const initials = address.slice(2, 4).toUpperCase();

  const handleDisconnect = () => {
    disconnect();
    logout();
    setShowSheet(false);
  };
  return (
    <>
      <SheetTrigger asChild>
        <button
          className={cn(
            "flex items-center gap-2 pl-1 pr-4 py-1",
            "bg-gradient-to-b from-white/20 via-white/10 to-white/5",
            "rounded-xl",
            "border border-gray-700",
            "shadow-[0_2px_0_0_rgba(0,0,0,0.2)]",
            "active:shadow-[0_1px_0_0_rgba(0,0,0,0.2)] active:translate-y-0.5",
            "transition-all duration-150",
            className
          )}
          onClick={() => setShowSheet(true)}
        >
          {/* Avatar */}
          <div className="w-7 h-7 rounded-full bg-black flex items-center justify-center">
            <span className="text-[10px] font-bold text-delulu-dark">
              {initials}
            </span>
          </div>
          <span className="text-sm font-bold text-white">
            {truncatedAddress}
          </span>
        </button>
      </SheetTrigger>

      <ResponsiveSheet
        open={showSheet}
        onOpenChange={setShowSheet}
        title={displayName}
        sheetClassName="bg-zinc-900 flex flex-col items-center justify-center rounded-t-3xl pb-8 [&>button]:text-white [&>button]:bg-white/10 [&>button]:hover:bg-white/20"
        modalClassName="max-w-md"
      >
        <div className="mt-6 space-y-4 lg:mt-4">
          <button
            onClick={handleDisconnect}
            className={cn(
              "w-full py-3",
              "bg-gradient-to-b from-delulu-dark via-delulu-dark to-[#1a1a1a]",
              "text-white",
              "rounded-xl font-black",
              "border-2 border-black/30",
              "shadow-[0_4px_0_0_#0a0a0a]",
              "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
              "transition-all duration-150"
            )}
          >
            Disconnect
          </button>
        </div>
      </ResponsiveSheet>
    </>
  );
}

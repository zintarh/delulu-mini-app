"use client";

import { useState, useEffect } from "react";
import { useAccount, useConnect } from "wagmi";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
// ============================================
// LOCAL TESTING MODE
// ============================================
// When NOT in Farcaster frame, show connector selection modal
// Comment out the ConnectorSelectionSheet import and usage to disable this feature
const ENABLE_LOCAL_WALLET_SELECTION = true; // Set to false to disable local wallet selection

// Import for local wallet selection (comment out to disable)
import { ConnectorSelectionSheet } from "@/components/connector-selection-sheet";
import { useMiniApp } from "@/contexts/miniapp-context";

export function LoginScreen() {
  const [mounted, setMounted] = useState(false);
  const { isConnected, isConnecting } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const [hasAttemptedConnect, setHasAttemptedConnect] = useState(false);
  const [showConnectorSheet, setShowConnectorSheet] = useState(false);
  
  // Check if we're in a Farcaster frame
  // If context exists, we're in a Farcaster frame
  const { context } = useMiniApp();
  const isInFarcasterFrame = !!context;

  useEffect(() => {
    setMounted(true);
  }, []);

  const frameConnector = connectors.find(
    (connector) => connector.id === "farcaster"
  );
  const isLoading = isConnecting || isPending;

  // Farcaster frame flow (original behavior)
  const handleFarcasterLogin = () => {
    if (frameConnector && !isLoading && !hasAttemptedConnect) {
      setHasAttemptedConnect(true);
      connect({ connector: frameConnector });
    }
  };

  // Local testing flow - open connector selection
  const handleLocalConnect = () => {
    if (ENABLE_LOCAL_WALLET_SELECTION) {
      setShowConnectorSheet(true);
    }
  };

  // Determine which handler to use
  const handleLogin = isInFarcasterFrame ? handleFarcasterLogin : handleLocalConnect;
  const isLoginDisabled = isInFarcasterFrame 
    ? (isLoading || !frameConnector || hasAttemptedConnect)
    : false;

  if (!mounted || isConnected) {
    return null;
  }

  return (
    <div className="min-h-screen bg-delulu-yellow flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Logo */}
        <div
          className={cn(
            "text-6xl md:text-8xl font-black text-delulu-dark tracking-tighter mb-4",
            "animate-slide-up-from-bottom"
          )}
          style={{
            fontFamily: "var(--font-gloria), cursive",
          }}
        >
          delulu<span className="text-delulu-purple -ml-1">.</span>
        </div>

        {/* Tagline */}
        <div
          className={cn(
            "text-sm md:text-lg font-bold text-delulu-dark/80 mb-12",
            "animate-slide-up-from-bottom-delayed"
          )}
          style={{
            animationDelay: "0.3s",
          }}
        >
          it&apos;s your world be delusional bestie :)
        </div>

        {/* Login/Connect Button */}
        <button
          onClick={handleLogin}
          disabled={isLoginDisabled}
          className={cn(
            "w-full max-w-xs",
            "px-8 py-4",
            "bg-white rounded-full",
            "text-delulu-dark font-black text-lg",
            "shadow-[0_4px_0_0_#0a0a0a]",
            "active:shadow-[0_2px_0_0_#0a0a0a] active:translate-y-0.5",
            "transition-all duration-150",
            "disabled:opacity-70 disabled:shadow-[0_2px_0_0_#0a0a0a]",
            "flex items-center justify-center gap-2"
          )}
        >
          {isLoading && isInFarcasterFrame ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Connecting...</span>
            </>
          ) : (
            <span>{isInFarcasterFrame ? "Login" : "Connect Wallet"}</span>
          )}
        </button>

        {/* Terms */}
        <p className="mt-8 text-xs text-delulu-dark/50 text-center max-w-xs">
          By signing in, you agree to the{" "}
          <a href="#" className="text-delulu-dark/70 underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-delulu-dark/70 underline">
            Privacy Policy
          </a>
        </p>
      </div>

      {/* Local Testing: Connector Selection Sheet */}
      {/* Comment out the line below to disable local wallet selection */}
      {ENABLE_LOCAL_WALLET_SELECTION && (
        <ConnectorSelectionSheet
          open={showConnectorSheet}
          onOpenChange={setShowConnectorSheet}
        />
      )}
    </div>
  );
}

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
    <div 
      className="min-h-screen flex flex-col items-center justify-center px-6 relative"
      style={{
        backgroundImage: "url('/island1.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center",
        backgroundRepeat: "no-repeat",
      }}
    >
      {/* Light overlay for optimistic feel */}
      <div className="absolute inset-0 bg-white/70" />
      
      <div className="w-full max-w-md flex flex-col items-center relative z-10">
        {/* Logo */}
        <div
          className={cn(
            "text-6xl md:text-8xl font-black text-delulu-charcoal tracking-tighter mb-4",
            "animate-slide-up-from-bottom"
          )}
          style={{
            fontFamily: "var(--font-gloria), cursive",
          }}
        >
          delulu<span className="text-delulu-charcoal -ml-1">.</span>
        </div>

        {/* Tagline */}
        <div
          className={cn(
            "text-sm md:text-lg font-bold text-delulu-charcoal/80 mb-12",
            "animate-slide-up-from-bottom-delayed"
          )}
          style={{
            animationDelay: "0.3s",
          }}
        >
          it&apos;s your world be delusional bestie :)
        </div>

        {/* Login/Connect Button - Yellow primary button */}
        <button
          onClick={handleLogin}
          disabled={isLoginDisabled}
          className={cn(
            "w-full max-w-xs",
            "px-8 py-4",
            "bg-delulu-yellow-reserved",
            "text-delulu-charcoal text-lg font-bold",
            "rounded-md border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]",
            "flex items-center justify-center gap-2",
            "hover:translate-x-[2px] hover:translate-y-[2px] hover:shadow-[1px_1px_0px_0px_#1A1A1A]",
            "active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
            "transition-all duration-100"
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
        <p className="mt-8 text-xs text-gray-500 text-center max-w-xs">
          By signing in, you agree to the{" "}
          <a href="#" className="text-delulu-charcoal underline">
            Terms of Service
          </a>{" "}
          and{" "}
          <a href="#" className="text-delulu-charcoal underline">
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

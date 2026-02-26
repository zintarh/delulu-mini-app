"use client";

import { useState, useRef, useEffect } from "react";
import { useApolloClient } from "@apollo/client/react";
import { refetchDeluluData } from "@/lib/graph/refetch-utils";
import { FormattedDelulu } from "@/lib/types";
import { formatTimeRemaining, cn, getCountryFlag } from "@/lib/utils";
import { useCancelDelulu } from "@/hooks/use-cancel-delulu";
import { useAccount } from "wagmi";
import { isDeluluCreator } from "@/lib/delulu-utils";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";

function getCardBackground(delusion: FormattedDelulu): {
  bg: string;
  text: string;
  isImage: boolean;
} {
  if (delusion.bgImageUrl) {
    let imageUrl = delusion.bgImageUrl;
    
    if (imageUrl.startsWith("/")) {
      if (typeof window !== "undefined") {
        imageUrl = `${window.location.origin}${imageUrl}`;
      } else {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
        imageUrl = `${baseUrl}${imageUrl}`;
      }
    }
    
    if (typeof window !== "undefined") {
      const currentOrigin = window.location.origin;
      imageUrl = imageUrl.replace(/https?:\/\/localhost:\d+/g, currentOrigin);
            if (window.location.protocol === "https:") {
        imageUrl = imageUrl.replace(/^http:/, "https:");
      }
    }
    
    if (
      imageUrl.startsWith("http://") ||
      imageUrl.startsWith("https://")
    ) {
      return {
        bg: imageUrl,
        text: "text-white",
        isImage: true,
      };
    }
  }

  // Default fallback
  const baseUrl = typeof window !== "undefined" 
    ? window.location.origin 
    : process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
  
  return {
    bg: `${baseUrl}/templates/t0.png`,
    text: "text-white",
    isImage: true,
  };
}

interface ProfileDeluluCardProps {
  delusion: FormattedDelulu;
  onClick: () => void;
  onStake?: () => void;
  onResolve?: () => void;
  className?: string;
}

export function ProfileDeluluCard({
  delusion,
  onClick,
  onStake,
  onResolve,
  className = "",
}: ProfileDeluluCardProps) {
  const { address } = useAccount();
  const apolloClient = useApolloClient();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const {
    cancel,
    isPending: isCancelling,
    isConfirming: isCancellingConfirming,
    isSuccess: isCancelSuccess,
    error: cancelError,
  } = useCancelDelulu();
  const isCreator = isDeluluCreator(address, delusion);
  const canCancel = isCreator && !delusion.isResolved && !delusion.isCancelled;

  // Only use content if it exists and is not a hash
  const isHash = (str: string) => {
    return str.startsWith("Qm") || (str.length > 40 && /^[a-f0-9]+$/i.test(str));
  };
  
  const headlineRaw = delusion.content && !isHash(delusion.content)
    ? delusion.content
    : "";
  const headline = headlineRaw.trim() || "YOUR DELULU HEADLINE";

  const cardBackground = getCardBackground(delusion);
  const textColorClass =
    cardBackground.text === "text-black" ? "text-black" : "text-white";



  const handleStake = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onStake) {
      onStake();
    } else {
      onClick();
    }
  };


  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowCancelModal(true);
  };

  const handleConfirmCancel = async () => {
    if (!address || !isCreator) {
      return;
    }

    try {
      const deluluIdForContract = delusion.id;
      await cancel(deluluIdForContract, address);
    } catch (error) {
      console.error("[ProfileDeluluCard] Error cancelling delulu:", error);
    }
  };

  useEffect(() => {
    if (isCancelSuccess && showCancelModal) {
      setShowCancelModal(false);
      const deluluId = delusion.onChainId || delusion.id;
      refetchDeluluData(apolloClient, deluluId);
    }
  }, [isCancelSuccess, showCancelModal, apolloClient, delusion.id, delusion.onChainId]);

  const handleModalOpenChange = (open: boolean) => {
    if (!open && (isCancelling || isCancellingConfirming)) {
      return;
    }
    setShowCancelModal(open);
  };

  return (
    <div className={cn(className, "block")}>
      <div
        onClick={onClick}
        className="relative w-full aspect-[3/4] rounded-lg overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      >
        <div
          className={cn("absolute inset-0 bg-cover bg-no-repeat bg-center")}
          style={
            cardBackground.isImage
              ? {
                  backgroundImage: `url(${cardBackground.bg})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                  backgroundRepeat: "no-repeat",
                }
              : {
                  background: cardBackground.bg,
                }
          }
        />

        {cardBackground.isImage && (
          <div className="absolute inset-0 bg-black/50 z-[1]" />
        )}

        <div className="absolute top-2 left-2 z-20 flex items-center gap-1.5">
          {delusion.gatekeeper?.enabled && (
            <div className="px-1.5 py-0.5 rounded-full bg-white/10 border border-white/30 backdrop-blur-sm flex items-center justify-center">
              <span className="text-sm">
                {getCountryFlag(delusion.gatekeeper.value)}
              </span>
            </div>
          )}
        </div>


        <div className="absolute inset-3 flex items-center justify-center text-center z-10">
          <div className="bg-white w-full max-w-[90%] rounded-sm py-2 px-2">
            <p
              className={cn(
                "font-black leading-tight text-delulu-charcoal text-xs line-clamp-2"
              )}
              title={headline}
            >
              {headline}
            </p>
          </div>
        </div>

        <div className="absolute bottom-2 right-2 z-20">
          <div
            className={cn(
              "px-2 py-1 rounded-full text-[9px] font-medium flex items-center gap-1",
              delusion.isCancelled
                ? "bg-red-500 text-white"
                : delusion.isResolved
                ? "bg-delulu-green text-black"
                : textColorClass === "text-black"
                ? "bg-black/80 text-white"
                : "bg-black text-white"
            )}
          >
            {(() => {
              if (delusion.isCancelled) {
                return <span className="font-semibold">Cancelled</span>;
              }
              if (delusion.isResolved) {
                return <span className="font-semibold">Resolved</span>;
              }
              const timeRemaining = formatTimeRemaining(
                delusion.stakingDeadline
              );
              const isEnded = timeRemaining === "Ended";
              return (
                <>
                  {!isEnded && <span className="opacity-70">Ends in</span>}
                  <span className="font-semibold">{timeRemaining}</span>
                </>
              );
            })()}
          </div>
        </div>

        <div className="absolute bottom-2 left-2 z-20">
          <span
            className={cn(
              "text-[8px] tracking-[0.25em] uppercase",
              textColorClass === "text-black"
                ? "text-black/50"
                : "text-white/50"
            )}
          >
            D E L U L U
          </span>
        </div>
      </div>

      <Modal open={showCancelModal} onOpenChange={handleModalOpenChange}>
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="text-delulu-charcoal text-xl font-bold">
              Cancel Delulu
            </ModalTitle>
          </ModalHeader>
          <div className="mt-4 space-y-4">
            {!isCancelSuccess && !cancelError && (
              <p className="text-gray-600">
                Are you sure you want to cancel this delulu? This action cannot
                be undone.
              </p>
            )}
            {isCancelSuccess && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600 font-medium">
                  ✓ Delulu cancelled successfully!
                </p>
              </div>
            )}
            {cancelError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">
                  {cancelError instanceof Error
                    ? cancelError.message
                    : "Transaction failed"}
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleModalOpenChange(false)}
                disabled={isCancelling || isCancellingConfirming}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                No, Keep It
              </button>
              <button
                onClick={handleConfirmCancel}
                disabled={isCancelling || isCancellingConfirming}
                className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {isCancelling || isCancellingConfirming ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Cancelling...
                  </>
                ) : (
                  "Yes, Cancel"
                )}
              </button>
            </div>
          </div>
        </ModalContent>
      </Modal>

    </div>
  );
}

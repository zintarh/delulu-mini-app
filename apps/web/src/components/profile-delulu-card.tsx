"use client";

import { useState, useRef, useEffect } from "react";
import { MoreHorizontal } from "lucide-react";
import { FormattedDelulu } from "@/hooks/use-delulus";
import { formatTimeRemaining, cn, getCountryFlag } from "@/lib/utils";
import { useCancelDelulu } from "@/hooks/use-cancel-delulu";
import { useResolveDelulu } from "@/hooks/use-resolve-delulu";
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
    if (
      delusion.bgImageUrl.startsWith("http://") ||
      delusion.bgImageUrl.startsWith("https://") ||
      delusion.bgImageUrl.startsWith("/")
    ) {
      return {
        bg: delusion.bgImageUrl,
        text: "text-white",
        isImage: true,
      };
    }
  }

  return {
    bg:
      typeof window !== "undefined"
        ? `${window.location.origin}/templates/t0.png`
        : "/templates/t0.png",
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
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [showDeadlineNotification, setShowDeadlineNotification] = useState(false);
  const [resolveOutcome, setResolveOutcome] = useState<boolean | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    cancel,
    isPending: isCancelling,
    isConfirming: isCancellingConfirming,
    isSuccess: isCancelSuccess,
    error: cancelError,
  } = useCancelDelulu();
  const {
    resolve,
    isPending: isResolving,
    isConfirming: isResolvingConfirming,
    isSuccess: isResolveSuccess,
    isBackendSynced: isResolveBackendSynced,
    isBackendSyncing: isResolveBackendSyncing,
    error: resolveError,
  } = useResolveDelulu();

  const isDeadlinePassed = new Date() > delusion.stakingDeadline;
  const canResolve =
    isDeadlinePassed && !delusion.isResolved && !delusion.isCancelled;
  const isCreator = isDeluluCreator(address, delusion);
  const canCancel = isCreator && !delusion.isResolved && !delusion.isCancelled;

  const headlineRaw = delusion.content || delusion.contentHash || "";
  const headline = headlineRaw.trim();
  const headlineLength = headline.length;
  const truncatedHeadline =
    headlineLength > 20 ? headline.slice(0, 20) + "..." : headline;

  const cardBackground = getCardBackground(delusion);
  const textColorClass =
    cardBackground.text === "text-black" ? "text-black" : "text-white";

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }
    if (isMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleMenuToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(!isMenuOpen);
  };

  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        shareMenuRef.current &&
        !shareMenuRef.current.contains(event.target as Node)
      ) {
        setShowShareMenu(false);
      }
    }
    if (showShareMenu) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [showShareMenu]);

  const handleStake = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (onStake) {
      onStake();
    } else {
      onClick();
    }
  };

  const handleResolve = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
    if (delusion.isResolved || delusion.isCancelled) {
      return;
    }
    if (!isDeadlinePassed) {
      setShowDeadlineNotification(true);
      return;
    }
    setShowResolveModal(true);
  };

  const handleConfirmResolve = async () => {
    if (!address || resolveOutcome === null) {
      return;
    }

    if (delusion.isResolved || delusion.isCancelled) {
      return;
    }

    const deluluIdForContract = delusion.onChainId
      ? parseInt(delusion.onChainId)
      : delusion.id;

    try {
      await resolve(deluluIdForContract, resolveOutcome, address);
    } catch (error) {
      console.error("[ProfileDeluluCard] Error resolving delulu:", error);
    }
  };

  useEffect(() => {
    if (isResolveSuccess && isResolveBackendSynced && showResolveModal) {
      const timer = setTimeout(() => {
        setShowResolveModal(false);
        setResolveOutcome(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isResolveSuccess, isResolveBackendSynced, showResolveModal]);

  const handleResolveModalOpenChange = (open: boolean) => {
    if (
      !open &&
      (isResolving || isResolvingConfirming || isResolveBackendSyncing)
    ) {
      return;
    }
    if (!open && isResolveSuccess && !isResolveBackendSynced) {
      return;
    }
    setShowResolveModal(open);
    if (!open) {
      setResolveOutcome(null);
    }
  };

  const handleCancelClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsMenuOpen(false);
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
    }
  }, [isCancelSuccess, showCancelModal]);

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
        className="relative w-full aspect-[4/5] rounded-lg overflow-hidden active:scale-[0.98] transition-transform cursor-pointer"
      >
        <div
          className={cn("absolute inset-0 !bg-contain bg-no-repeat")}
          style={{
            backgroundImage: cardBackground.isImage
              ? `url(${cardBackground.bg})`
              : undefined,
          }}
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

        {!delusion.isResolved && !delusion.isCancelled && (
          <div className="absolute top-2 right-2 z-30" ref={menuRef}>
            <button
              onClick={handleMenuToggle}
              className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center transition-colors",
                textColorClass === "text-black"
                  ? "bg-black/20 hover:bg-black/40 text-black"
                  : "bg-white/20 hover:bg-white/40 text-white"
              )}
              title="Menu"
              aria-label="Menu"
            >
              <MoreHorizontal className="w-6 h-6" />
            </button>

            {isMenuOpen && (
              <div className="absolute top-9 right-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50 min-w-[120px]">
                {/* <div className="relative" ref={shareMenuRef}>
                <button
                  onClick={handleShare}
                  className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors flex items-center"
                  title="Share"
                  aria-label="Share"
                >
                  Share
                </button>

                {showShareMenu && (
                  <div className="absolute right-full top-0 mr-2 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50 p-3 w-[240px]">
                    <p className="text-xs font-medium text-gray-500 mb-3 text-center">
                      Share to
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={handleShareWhatsApp}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Share to WhatsApp"
                      >
                        <svg
                          className="w-7 h-7"
                          viewBox="0 0 24 24"
                          fill="#25D366"
                        >
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                        </svg>
                        <span className="text-[10px] font-medium text-delulu-charcoal">
                          WhatsApp
                        </span>
                      </button>
                      <button
                        onClick={handleShareTwitter}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Share to X"
                      >
                        <svg
                          className="w-7 h-7"
                          viewBox="0 0 24 24"
                          fill="#000000"
                        >
                          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                        </svg>
                        <span className="text-[10px] font-medium text-delulu-charcoal">
                          X
                        </span>
                      </button>
                      <button
                        onClick={handleShareInstagram}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                        title="Share to Instagram"
                      >
                        <svg
                          className="w-7 h-7"
                          viewBox="0 0 24 24"
                          fill="url(#instagram-gradient-profile-card)"
                        >
                          <defs>
                            <linearGradient
                              id="instagram-gradient-profile-card"
                              x1="0%"
                              y1="0%"
                              x2="100%"
                              y2="100%"
                            >
                              <stop offset="0%" stopColor="#833AB4" />
                              <stop offset="50%" stopColor="#FD1D1D" />
                              <stop offset="100%" stopColor="#FCB045" />
                            </linearGradient>
                          </defs>
                          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
                        </svg>
                        <span className="text-[10px] font-medium text-delulu-charcoal">
                          Instagram
                        </span>
                      </button>
                      <button
                        onClick={handleCopyLink}
                        className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors col-span-3 border-t border-gray-200 mt-2 pt-3"
                        title="Copy Link"
                      >
                        <span className="text-[10px] font-medium text-delulu-charcoal">
                          Copy Link
                        </span>
                      </button>
                    </div>
                  </div>
                  )}
                </div> */}

                {!delusion.isResolved && !delusion.isCancelled && (
                  <button
                    onClick={handleResolve}
                    className="w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors border-t border-gray-200 flex items-center"
                    title="Resolve"
                    aria-label="Resolve"
                  >
                    Resolve
                  </button>
                )}
                {false && canCancel && (
                  <button
                    onClick={handleCancelClick}
                    disabled={isCancelling || isCancellingConfirming}
                    className="w-full px-4 py-2.5 text-left text-sm text-red-600 hover:bg-gray-50 transition-colors border-t border-gray-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                    title="Cancel"
                    aria-label="Cancel"
                  >
                    {isCancelling || isCancellingConfirming ? (
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                        Cancelling...
                      </span>
                    ) : (
                      "Cancel"
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <div className="absolute inset-3 flex items-center justify-center text-center z-10">
          <div className="bg-white w-fit h-fit rounded-sm py-2 px-2">
            <p
              className={cn(
                "font-black leading-tight text-delulu-charcoal text-xs"
              )}
              title={headline || "YOUR DELULU HEADLINE"}
            >
              {truncatedHeadline || "YOUR DELULU HEADLINE"}
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
                : canResolve
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
              if (canResolve) {
                return <span className="font-semibold">Ready to resolve</span>;
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

      <Modal
        open={showResolveModal}
        onOpenChange={handleResolveModalOpenChange}
      >
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle className="text-delulu-charcoal text-xl font-bold">
              Resolve Delulu
            </ModalTitle>
          </ModalHeader>
          <div className="mt-4 space-y-4">
            {!isResolveSuccess && !resolveError && resolveOutcome === null && (
              <div className="space-y-3">
                <p className="text-gray-600">
                  Select the outcome for this delulu:
                </p>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setResolveOutcome(true)}
                    className="p-4 rounded-lg border-2 border-gray-200 hover:border-delulu-green hover:bg-delulu-green/5 transition-colors text-left"
                  >
                    <div className="font-semibold text-delulu-charcoal mb-1">
                      Believers Win
                    </div>
                    <div className="text-sm text-gray-600">
                      The delulu came true
                    </div>
                  </button>
                  <button
                    onClick={() => setResolveOutcome(false)}
                    className="p-4 rounded-lg border-2 border-gray-200 hover:border-red-500 hover:bg-red-50 transition-colors text-left"
                  >
                    <div className="font-semibold text-delulu-charcoal mb-1">
                      Doubters Win
                    </div>
                    <div className="text-sm text-gray-600">
                      The delulu did not come true
                    </div>
                  </button>
                </div>
              </div>
            )}
            {!isResolveSuccess && !resolveError && resolveOutcome !== null && (
              <p className="text-gray-600">
                Are you sure you want to resolve this delulu as{" "}
                <span className="font-semibold">
                  {resolveOutcome ? "Believers Win" : "Doubters Win"}
                </span>
                ? This action cannot be undone.
              </p>
            )}
            {isResolveSuccess && isResolveBackendSynced && (
              <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
                <p className="text-sm text-green-600 font-medium">
                  ✓ Delulu resolved successfully!
                </p>
              </div>
            )}
            {resolveError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600 font-medium">
                  {resolveError instanceof Error
                    ? resolveError.message
                    : "Transaction failed"}
                </p>
              </div>
            )}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => handleResolveModalOpenChange(false)}
                disabled={
                  isResolving ||
                  isResolvingConfirming ||
                  isResolveBackendSyncing
                }
                className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {resolveOutcome === null ? "Cancel" : "Back"}
              </button>
              {resolveOutcome !== null && (
                <button
                  onClick={handleConfirmResolve}
                  disabled={
                    isResolving ||
                    isResolvingConfirming ||
                    isResolveBackendSyncing ||
                    isResolveSuccess ||
                    resolveOutcome === null ||
                    delusion.isResolved ||
                    delusion.isCancelled
                  }
                  className="flex-1 px-4 py-2.5 text-sm font-medium text-delulu-charcoal bg-delulu-yellow-reserved hover:bg-delulu-yellow-reserved/90 rounded-md border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isResolving || isResolvingConfirming ? (
                    <>
                      <div className="w-4 h-4 border-2 border-delulu-charcoal border-t-transparent rounded-full animate-spin" />
                      Resolving...
                    </>
                  ) : isResolveBackendSyncing ? (
                    <>
                      <div className="w-4 h-4 border-2 border-delulu-charcoal border-t-transparent rounded-full animate-spin" />
                      Syncing...
                    </>
                  ) : isResolveSuccess && isResolveBackendSynced ? (
                    "Done"
                  ) : (
                    "Confirm Resolve"
                  )}
                </button>
              )}
            </div>
          </div>
        </ModalContent>
      </Modal>

      <ResponsiveSheet
        open={showDeadlineNotification}
        onOpenChange={setShowDeadlineNotification}
        sheetClassName="border-t border-gray-200 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[80] rounded-t-3xl bg-white"
      >
        <div className="px-6 py-8">
          <div className="text-center">
            <h3 className="text-lg font-black text-delulu-charcoal mb-3">
              Not Ready Yet
            </h3>
            <p className="text-sm text-gray-600 mb-6">
              You can resolve this delulu after the staking deadline has passed.
            </p>
            <button
              onClick={() => setShowDeadlineNotification(false)}
              className="w-full px-4 py-3 text-sm font-medium text-delulu-charcoal bg-delulu-yellow-reserved hover:bg-delulu-yellow-reserved/90 rounded-md border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A] active:scale-[0.98] transition-all"
            >
              Got it
            </button>
          </div>
        </div>
      </ResponsiveSheet>
    </div>
  );
}

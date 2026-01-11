"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, CircleDollarSign, Copy } from "lucide-react";
import { FormattedDelulu } from "@/hooks/use-delulus";
import {
  formatTimeRemaining,
  formatTimeAgo,
  cn,
  getCountryFlag,
} from "@/lib/utils";
import { api } from "@/lib/api-client";

function formatAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

const PALETTE = [
  { id: "delulu", bg: "#F5AAB6", text: "text-black" },
  { id: "void", bg: "#656A3F", text: "text-white" },
  { id: "aura", bg: "#665B87", text: "text-white" },
  { id: "bag", bg: "#DCD6C0", text: "text-black" },
  { id: "cloud", bg: "#364378", text: "text-white" },
  {
    id: "heat",
    bg: "linear-gradient(to right, #f97316, #dc2626)",
    text: "text-white",
  },
];

function getCardBackground(delusion: FormattedDelulu): {
  bg: string;
  text: string;
  isImage: boolean;
} {
  if (delusion.bgImageUrl) {
    let imageUrl = delusion.bgImageUrl;
    
    // Convert relative paths to absolute URLs
    if (imageUrl.startsWith("/")) {
      if (typeof window !== "undefined") {
        imageUrl = `${window.location.origin}${imageUrl}`;
      } else {
        // Server-side: use environment variable or default
        const baseUrl = process.env.NEXT_PUBLIC_URL || "http://localhost:3000";
        imageUrl = `${baseUrl}${imageUrl}`;
      }
    }
    
    // Replace localhost URLs with current origin (handles production)
    if (typeof window !== "undefined") {
      const currentOrigin = window.location.origin;
      // Replace any localhost URLs with current origin
      imageUrl = imageUrl.replace(/https?:\/\/localhost:\d+/g, currentOrigin);
      
      // Ensure HTTPS if page is served over HTTPS
      if (window.location.protocol === "https:") {
        imageUrl = imageUrl.replace(/^http:/, "https:");
      }
    }
    
    if (
      imageUrl.startsWith("http://") ||
      imageUrl.startsWith("https://")
    ) {
      return {
        bg: `url(${imageUrl})`,
        text: "text-white", 
        isImage: true,
      };
    }
    const isGradient = delusion.bgImageUrl.includes("gradient");
    const isDark = !isGradient && isColorDark(delusion.bgImageUrl);
    return {
      bg: delusion.bgImageUrl,
      text: isDark ? "text-white" : "text-black",
      isImage: false,
    };
  }

  const seed = delusion.contentHash || delusion.creator || "";
  const hash = seed
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % PALETTE.length;
  return { ...PALETTE[index], isImage: false };
}

function isColorDark(color: string): boolean {
  if (color.startsWith("#")) {
    const hex = color.slice(1);
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance < 0.5;
  }
  return true;
}

interface DeluluCardProps {
  delusion: FormattedDelulu;
  onClick?: () => void;
  href?: string;
  onStake?: () => void;
  className?: string;
  isLast?: boolean;
}

export function DeluluCard({
  delusion,
  onClick,
  href,
  onStake,
  className = "",
  isLast = false,
}: DeluluCardProps) {
  const total = delusion.totalBelieverStake + delusion.totalDoubterStake;
  
  // Always use the creator's profile data from the delulu object
  // This comes from the API and includes the creator's profile information
  const displayPfpUrl = delusion.pfpUrl || null;
  const displayUsername = delusion.username || null;

  const headlineRaw = delusion.content || delusion.contentHash || "";
  const headline = headlineRaw.trim();
  const headlineLength = headline.length;

  const tvl = total;
  const formattedTVL =
    tvl > 0 ? (tvl < 0.01 ? tvl.toFixed(4) : tvl.toFixed(2)) : "0.00";

  const cardBackground = getCardBackground(delusion);
  const textColorClass =
    cardBackground.text === "text-black" ? "text-black" : "text-balck";

  const queryClient = useQueryClient();
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

  const getShareUrl = () => {
    const baseUrl = typeof window !== "undefined" ? window.location.origin : "";
    return `${baseUrl}/delulu/${delusion.id}`;
  };

  const getShareText = () => {
    return `Check out this delulu: ${headline}`;
  };

  const shareLink = async (
    platform: "whatsapp" | "twitter" | "native"
  ) => {
    const url = getShareUrl();
    const text = getShareText();

    if (platform === "native" && navigator.share) {
      try {
        await navigator.share({
          title: headline,
          text: text,
          url: url,
        });
        return true;
      } catch (err) {
        // User cancelled or error
        return false;
      }
    }

    if (platform === "whatsapp") {
      const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(
        `${text} ${url}`
      )}`;
      window.open(whatsappUrl, "_blank");
      return true;
    }

    if (platform === "twitter") {
      const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
        text
      )}&url=${encodeURIComponent(url)}`;
      window.open(twitterUrl, "_blank");
      return true;
    }

    return false;
  };

  const handleShareClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareMenu(!showShareMenu);
  };

  const handleShareWhatsApp = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareMenu(false);
    await shareLink("whatsapp");
  };

  const handleShareTwitter = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowShareMenu(false);
    await shareLink("twitter");
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const url = getShareUrl();
    try {
      await navigator.clipboard.writeText(url);
      alert("Link copied to clipboard!");
    } catch (err) {
      console.error("Failed to copy link:", err);
    }
    setShowShareMenu(false);
  };

  const handleStake = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onStake) {
      onStake();
    } else if (onClick) {
      onClick();
    }
  };

  // Prefetch delulu data on hover for instant navigation
  const handleMouseEnter = () => {
    if (href) {
      queryClient.prefetchQuery({
        queryKey: ["delulu", delusion.id],
        queryFn: () => api.getDelulu(String(delusion.id)),
        staleTime: 30 * 1000,
      });
    }
  };

  const handleCardClick = (e: React.MouseEvent) => {
    if (onClick) {
      e.preventDefault();
      onClick();
    }
  };

  const cardContent = (
    <>
      <div className="flex items-center gap-2 mb-2 border-gray-200">
        {displayPfpUrl ? (
          <img
            src={displayPfpUrl}
            alt={displayUsername || delusion.creator}
            className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-200"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
            <span className="text-[9px] font-bold text-delulu-charcoal">
              {formatAddress(delusion.creator).slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-delulu-charcoal">
              {displayUsername
                ? `@${displayUsername}`
                : formatAddress(delusion.creator)}
            </span>
            <span className="text-xs text-gray-400">·</span>
            <span className="text-xs text-gray-400">
              {formatTimeAgo(
                delusion.createdAt ||
                  new Date(
                    delusion.stakingDeadline.getTime() - 7 * 24 * 60 * 60 * 1000
                  )
              )}
            </span>
          </div>
        </div>
      </div>

      <div
        onClick={href ? undefined : handleCardClick}
        onMouseEnter={handleMouseEnter}
        className="relative w-full aspect-[4/5] rounded-xl overflow-hidden active:scale-[0.98] transition-transform cursor-pointer shadow-sm border border-gray-100"
      >
        <div
          className={cn("absolute inset-0 !bg-contain bg-no-repeat bg-center")}
          style={
            cardBackground.isImage
              ? {
                  backgroundImage: cardBackground.bg,
                  backgroundSize: "contain",
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

        {delusion.gatekeeper?.enabled && (
          <div className="absolute top-3 left-3 z-20">
            <div className="px-2 py-1 rounded-full border-0 bg-white/20 border-white/30 backdrop-blur-sm flex items-center justify-center">
              <span className="text-lg">
                {getCountryFlag(delusion.gatekeeper.value)}
              </span>
            </div>
          </div>
        )}

        <div className="absolute top-3 right-3 z-20">
          <div className="bg-delulu-yellow-reserved text-delulu-charcoal px-3 py-1.5 rounded-md border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]">
            <span className="text-[11px] font-black tracking-tight">
              ${formattedTVL} TVL
            </span>
          </div>
        </div>

        {/* Headline - Centered */}
        <div className="absolute inset-6 flex items-center justify-center  text-center z-10">
          <div className="bg-white w-fit h-fit rounded-md py-2 px-2">
            <p
              className={cn(
                "  break-words text-pretty text-center font-black  whitespace-pre-wrap",
                textColorClass,
                headlineLength <= 40
                  ? "text-xl"
                  : headlineLength <= 80
                  ? "text-lg"
                  : headlineLength <= 140
                  ? "text-base"
                  : "text-sm"
              )}
            >
              {headline || "YOUR DELULU HEADLINE"}
            </p>
          </div>
        </div>

        {/* Duration - Bottom Right, dark pill */}
        <div className="absolute bottom-3 right-3 z-20">
          <div
            className={cn(
              "px-3 py-1 rounded-full text-[11px] font-medium flex items-center gap-1",
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
              const timeRemaining = formatTimeRemaining(delusion.stakingDeadline);
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

        {/* Brand Watermark - Bottom Left */}
        <div className="absolute bottom-3 left-3 z-20">
          <span
            className={cn(
              "text-[9px] tracking-[0.35em] uppercase",
              textColorClass === "text-black"
                ? "text-black/50"
                : "text-white/50"
            )}
          >
            D E L U L U
          </span>
        </div>
      </div>

      {/* Action Buttons */}
      <div 
        className="flex items-center justify-between pt-1"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        <div className="relative" ref={shareMenuRef}>
          <button
            onClick={handleShareClick}
            className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
            aria-label="Share"
          >
            <Upload className="w-6 h-6" />
          </button>

          {/* Share Menu */}
          {showShareMenu && (
            <div className="absolute bottom-12 left-0 bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden z-50 p-3 w-[240px]">
              <p className="text-xs font-medium text-gray-500 mb-3 text-center">
                Share to
              </p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleShareWhatsApp}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Share to WhatsApp"
                >
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#25D366">
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
                  <svg className="w-7 h-7" viewBox="0 0 24 24" fill="#000000">
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  <span className="text-[10px] font-medium text-delulu-charcoal">
                    X
                  </span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                  title="Copy Link"
                >
                  <Copy className="w-5 h-5 text-gray-500" />
                  <span className="text-[10px] font-medium text-delulu-charcoal">
                    Copy Link
                  </span>
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Hide staking button if delulu is cancelled or resolved */}
        {!delusion.isCancelled && !delusion.isResolved && (
          <button
            onClick={handleStake}
            className="flex items-center justify-center w-10 h-10 rounded-full text-gray-500 hover:text-delulu-charcoal hover:bg-gray-100 transition-colors"
            aria-label="Stake"
          >
            <CircleDollarSign className="w-6 h-6" />
          </button>
        )}
      </div>
      {!isLast && <div className="border-b border-gray-200 mt-2" />}
    </>
  );

  // Wrap in Link if href is provided, otherwise use div
  if (href) {
    return (
      <Link
        href={href}
        className={cn(
          className,
          "block p-3 rounded-lg h-auto space-y-2 border-gray-200"
        )}
        prefetch={true}
      >
        {cardContent}
      </Link>
    );
  }

  return (
    <div
      className={cn(
        className,
        "block p-3 rounded-lg h-auto space-y-2 border-gray-200"
      )}
      onClick={onClick || undefined}
    >
      {cardContent}
    </div>
  );
}

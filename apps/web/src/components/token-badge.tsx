"use client";

import { useTokenMetadata } from "@/hooks/use-token-metadata";
import { TOKEN_LOGOS } from "@/lib/constant";
import { cn } from "@/lib/utils";

interface TokenBadgeProps {
  tokenAddress: string;
  className?: string;
  showLogo?: boolean;
  showText?: boolean;
  size?: "sm" | "md" | "lg";
}

export function TokenBadge({
  tokenAddress,
  className = "",
  showLogo = true,
  showText = true,
  size = "sm",
}: TokenBadgeProps) {
  const { symbol } = useTokenMetadata(tokenAddress);
  const addr = tokenAddress?.toLowerCase();
  const logoUrl = addr ? TOKEN_LOGOS[addr] : undefined;

  const sizeClasses =
    size === "sm"
      ? "text-[10px] px-1.5 py-0.5 gap-1"
      : size === "md"
      ? "text-xs px-2 py-1 gap-1.5"
      : "text-sm px-2.5 py-1.5 gap-2";

  if (!showLogo || !logoUrl) {
    return null;
  }

  return (
    <span
      className={cn(
        "inline-flex items-center",
        showText && "rounded-md border border-gray-200 bg-white/80 font-medium text-gray-700",
        sizeClasses,
        className
      )}
    >
      <img
        src={logoUrl}
        alt=""
        className={
          size === "sm"
            ? "h-3 w-3 rounded-full"
            : size === "md"
            ? "h-4 w-4 rounded-full"
            : "h-6 w-6 rounded-full"
        }
      />
      {showText && <span>{symbol}</span>}
    </span>
  );
}

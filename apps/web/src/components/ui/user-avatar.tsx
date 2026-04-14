"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

// Deterministic hue from any string — no external request needed
function hueFromString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) & 0xffffff;
  }
  return h % 360;
}

function initials(address: string, username?: string | null): string {
  if (username) return username.slice(0, 2).toUpperCase();
  // Use chars 2-4 of hex address (after "0x")
  return address.slice(2, 4).toUpperCase();
}

interface UserAvatarProps {
  address: string;
  username?: string | null;
  /** undefined = loading, null = no pfp, string = url */
  pfpUrl?: string | null;
  size?: number;
  className?: string;
}

/**
 * Shared avatar component used everywhere.
 * - pfpUrl === undefined  → pulsing skeleton (data still loading)
 * - pfpUrl === null       → coloured initials circle (no pfp set)
 * - pfpUrl === string     → real image; falls back to initials on error
 *
 * Zero external requests for the fallback — initials are rendered with CSS.
 */
export function UserAvatar({
  address,
  username,
  pfpUrl,
  size = 32,
  className,
}: UserAvatarProps) {
  const seed = username || address;
  const hue = useMemo(() => hueFromString(seed), [seed]);
  const letters = useMemo(() => initials(address, username), [address, username]);

  console.log(`[avatar] ${address.slice(0,8)}… pfpUrl=`, pfpUrl === undefined ? "undefined(skeleton)" : pfpUrl ?? "null(initials)");

  const sizeClass = `shrink-0 rounded-full overflow-hidden`;
  const style = { width: size, height: size, minWidth: size };

  // Loading skeleton
  if (pfpUrl === undefined) {
    return (
      <div
        className={cn(sizeClass, "bg-muted animate-pulse", className)}
        style={style}
      />
    );
  }

  // Initials fallback (no pfp)
  const InitialsCircle = (
    <div
      className={cn(sizeClass, "flex items-center justify-center font-bold select-none", className)}
      style={{
        ...style,
        background: `hsl(${hue},45%,30%)`,
        color: `hsl(${hue},70%,85%)`,
        fontSize: Math.max(9, Math.floor(size * 0.36)),
      }}
    >
      {letters}
    </div>
  );

  if (!pfpUrl) return InitialsCircle;

  return (
    <div className={cn(sizeClass, className)} style={style}>
      <img
        src={pfpUrl}
        alt={username ?? address}
        className="w-full h-full object-cover"
        onError={(e) => {
          // Swap to initials on broken URL without re-render cost
          const el = e.currentTarget.parentElement!;
          e.currentTarget.remove();
          el.style.cssText = `
            width:${size}px;height:${size}px;min-width:${size}px;
            background:hsl(${hue},45%,30%);color:hsl(${hue},70%,85%);
            border-radius:9999px;display:flex;align-items:center;
            justify-content:center;font-weight:700;font-size:${Math.max(9, Math.floor(size * 0.36))}px;
            user-select:none;overflow:hidden;flex-shrink:0;
          `;
          el.textContent = letters;
        }}
      />
    </div>
  );
}

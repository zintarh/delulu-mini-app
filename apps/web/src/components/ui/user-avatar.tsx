"use client";

import { cn } from "@/lib/utils";

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
 * - pfpUrl === null       → neutral initials circle (no pfp set)
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
  const letters = initials(address, username);

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

  // Initials fallback (no pfp) — theme-aware muted tokens, not a hardcoded
  // light-gray hex that used to wash out against a dark background.
  const InitialsCircle = (
    <div
      className={cn(
        sizeClass,
        "flex items-center justify-center bg-muted font-bold text-muted-foreground select-none",
        className,
      )}
      style={{
        ...style,
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
            background:rgb(var(--muted));color:rgb(var(--muted-foreground));
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

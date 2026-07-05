"use client";

import { UserAvatar } from "@/components/ui/user-avatar";
import { cn } from "@/lib/utils";

export type AvatarStackParticipant = {
  address: string;
  username?: string | null;
  pfpUrl?: string | null;
};

/**
 * Overlapping circular avatars ("facepile") that prove a participant count is
 * made up of real people rather than a plain number.
 */
export function AvatarStack({
  participants,
  total,
  max = 5,
  size = 20,
  className,
}: {
  participants: AvatarStackParticipant[];
  total: number;
  max?: number;
  size?: number;
  className?: string;
}) {
  if (participants.length === 0) return null;

  const shown = participants.slice(0, max);
  const remaining = Math.max(0, total - shown.length);

  return (
    <div className={cn("flex items-center", className)}>
      {shown.map((p, i) => (
        <UserAvatar
          key={p.address}
          address={p.address}
          username={p.username}
          pfpUrl={p.pfpUrl}
          size={size}
          className={cn("ring-2 ring-card", i > 0 && "-ml-2")}
        />
      ))}
      {remaining > 0 ? (
        <div
          className="-ml-2 flex shrink-0 items-center justify-center rounded-full bg-muted font-bold text-foreground ring-2 ring-card"
          style={{ width: size, height: size, fontSize: Math.max(9, Math.floor(size * 0.32)) }}
        >
          +{remaining > 99 ? "99" : remaining}
        </div>
      ) : null}
    </div>
  );
}

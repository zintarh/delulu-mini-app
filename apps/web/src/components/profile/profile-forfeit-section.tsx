"use client";

import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { Clock, Loader2, Plus, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

export type ForfeitFeedItem = {
  id: string;
  onChainCommitmentId: number | null;
  title: string;
  description: string | null;
  evidenceType: string;
  verificationMethod: string;
  status: string;
  createdAt: string;
  onChain: {
    stakeAmount: string;
    token: string;
    cadence: string;
    totalPeriods: number;
    currentPeriodIndex: number;
    currentPeriodDeadline: string;
    active: boolean;
    cancelled: boolean;
  } | null;
};

export const forfeitFeedKeys = {
  creator: (address: string) =>
    ["profile", "forfeit-commitments", address.toLowerCase()] as const,
};

async function fetchCreatorForfeits(address: string): Promise<ForfeitFeedItem[]> {
  const res = await fetch(
    `/api/forfeit/commitments/feed?address=${encodeURIComponent(address)}&role=creator`,
  );
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json?.error ?? "Failed to load forfeits");
  return (json.items ?? []) as ForfeitFeedItem[];
}

export function useCreatorForfeits(address: string | undefined) {
  return useQuery({
    queryKey: forfeitFeedKeys.creator(address ?? ""),
    queryFn: () => fetchCreatorForfeits(address!),
    enabled: Boolean(address),
    staleTime: 20_000,
  });
}

function statusLabel(item: ForfeitFeedItem): { text: string; className: string } {
  if (item.onChain?.cancelled || item.status === "cancelled") {
    return { text: "Cancelled", className: "bg-muted text-muted-foreground" };
  }
  if (item.status === "ended" || (item.onChain && !item.onChain.active)) {
    return { text: "Ended", className: "bg-muted text-muted-foreground" };
  }
  if (
    item.status === "active" ||
    item.onChain?.active ||
    item.status === "pending_verifier" ||
    item.status === "draft"
  ) {
    return { text: "Active", className: "bg-emerald-500/15 text-emerald-700" };
  }
  return { text: item.status.replace(/_/g, " "), className: "bg-muted text-muted-foreground" };
}

function ForfeitCard({ item }: { item: ForfeitFeedItem }) {
  const badge = statusLabel(item);
  const deadline = item.onChain?.currentPeriodDeadline
    ? new Date(Number(item.onChain.currentPeriodDeadline) * 1000)
    : null;

  return (
    <div className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p
            className="truncate text-base font-black text-foreground"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            {item.title || "Untitled forfeit"}
          </p>
          {item.description ? (
            <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{item.description}</p>
          ) : null}
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wide",
            badge.className,
          )}
        >
          {badge.text}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] font-semibold text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Shield className="h-3 w-3" />
          {item.verificationMethod.replace(/_/g, " ")}
        </span>
        {deadline && !Number.isNaN(deadline.getTime()) ? (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Due{" "}
            {deadline.toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </span>
        ) : null}
        {item.onChain ? (
          <span>
            Period {item.onChain.currentPeriodIndex + 1}/{item.onChain.totalPeriods}
          </span>
        ) : null}
      </div>
    </div>
  );
}

export function ProfileForfeitSection({ address }: { address: string }) {
  const { data, isLoading, isError } = useCreatorForfeits(address);
  const items = data ?? [];
  const activeItems = items.filter((item) => {
    if (item.onChain?.cancelled || item.status === "cancelled") return false;
    if (item.onChain && !item.onChain.active && item.status === "ended") return false;
    return true;
  });

  return (
    <div className="space-y-5">
      <Link
        href="/forfeit"
        className="flex items-center justify-between gap-3 rounded-3xl border border-delulu-blue/25 bg-delulu-blue/10 px-5 py-4 shadow-sm transition-colors hover:bg-delulu-blue/15"
      >
        <div className="min-w-0">
          <p
            className="text-base font-black text-foreground"
            style={{ fontFamily: '"Clash Display", sans-serif' }}
          >
            Create a forfeit
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Stake on a goal. Miss it, and the stake goes where you choose.
          </p>
        </div>
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-delulu-blue text-white">
          <Plus className="h-5 w-5" />
        </span>
      </Link>

      <div>
        <p
          className="mb-3 text-[10px] font-black uppercase tracking-[0.2em] text-foreground/40"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          Your forfeits
        </p>

        {isLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading forfeits…
          </div>
        ) : isError ? (
          <p className="py-12 text-center text-sm text-muted-foreground">
            Couldn&apos;t load your forfeits. Try again in a moment.
          </p>
        ) : activeItems.length === 0 ? (
          <div className="flex flex-col items-center rounded-2xl border border-dashed border-border/70 px-4 py-14 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <Plus className="h-6 w-6 text-muted-foreground" />
            </div>
            <p
              className="mb-1 text-lg font-black text-foreground"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              No active forfeits
            </p>
            <p className="max-w-xs text-sm text-muted-foreground">
              Create your first forfeit commitment to put skin in the game.
            </p>
            <Link
              href="/forfeit"
              className="mt-4 inline-flex h-10 items-center rounded-full bg-foreground px-5 text-sm font-bold text-background"
            >
              Create forfeit
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {activeItems.map((item) => (
              <ForfeitCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

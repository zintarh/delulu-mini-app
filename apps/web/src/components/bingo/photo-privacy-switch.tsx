"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Eye, Lock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { showAppToast } from "@/lib/celebrate";
import { cn } from "@/lib/utils";

const key = (address: string | undefined) => ["bingo-photo-privacy", address?.toLowerCase() ?? null];

/** The player's "Private photos" setting (one switch for all their Bingo cards). */
export function useBingoPhotoPrivacy() {
  const { address } = useAuth();
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: key(address),
    enabled: !!address,
    staleTime: 60_000,
    queryFn: async () => {
      const r = await fetch(`/api/bingo/privacy?address=${address}`, { cache: "no-store" });
      return r.ok ? ((await r.json()) as { private: boolean; ready: boolean }) : { private: false, ready: false };
    },
  });
  const m = useMutation({
    mutationFn: async (value: boolean) => {
      const r = await fetch("/api/bingo/privacy", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ private: value }) });
      const j = (await r.json().catch(() => ({}))) as { private?: boolean; error?: string };
      if (!r.ok) throw new Error(j.error ?? "Couldn't change that — try again.");
      return value;
    },
    onMutate: (value) => qc.setQueryData(key(address), { private: value, ready: true }),
    onError: (e, value) => {
      qc.setQueryData(key(address), { private: !value, ready: true });
      showAppToast(e instanceof Error ? e.message : "Couldn't change that — try again.");
    },
    onSuccess: () => {
      // Cards and the board re-read with the new setting.
      void qc.invalidateQueries({ queryKey: ["bingo"] });
      void qc.invalidateQueries({ queryKey: ["cheers"] });
    },
  });
  return { isPrivate: q.data?.private ?? false, ready: q.data?.ready ?? false, loading: q.isLoading, setPrivate: (v: boolean) => m.mutate(v), saving: m.isPending };
}

/**
 * Public / Private photos. Shown where people decide to play (join sheet) and
 * on their own card, so nobody has to find it in settings.
 */
export function PhotoPrivacySwitch({ className }: { className?: string }) {
  const { address } = useAuth();
  const { isPrivate, ready, setPrivate, saving, loading } = useBingoPhotoPrivacy();
  if (!address || !ready) return null;
  const Icon = isPrivate ? Lock : Eye;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isPrivate}
      disabled={saving || loading}
      onClick={() => setPrivate(!isPrivate)}
      className={cn(
        "flex w-full items-center gap-3 rounded-2xl border-2 px-3.5 py-2.5 text-left transition-colors",
        isPrivate ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
        className,
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-extrabold leading-tight">{isPrivate ? "Private photos" : "Public photos"}</span>
        <span className={cn("block text-[11px] font-semibold leading-snug", isPrivate ? "text-white/70" : "text-muted-foreground")}>
          {isPrivate ? "Only you see them · others see your progress" : "Shy? Tap to make them private"}
        </span>
      </span>
      <span className={cn("relative h-6 w-10 shrink-0 rounded-full transition-colors", isPrivate ? "bg-green" : "bg-line")} aria-hidden>
        <span className={cn("absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-[left]", isPrivate ? "left-[18px]" : "left-0.5")} />
      </span>
    </button>
  );
}

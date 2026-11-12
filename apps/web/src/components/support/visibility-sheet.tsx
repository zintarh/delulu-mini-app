"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Globe2, Lock } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Chip, GameButton, GameSwitch, HudPill } from "@/components/ds";
import { postVisibility, type VisibilityState } from "@/lib/support/pending-visibility";
import {
  PUBLIC_DESCRIPTION_MAX,
  SUPPORT_CATEGORIES,
  SUPPORT_CATEGORY_LABELS,
  type SupportCategory,
} from "@/lib/support/rules";
import { cn } from "@/lib/utils";

export const visibilityKey = (id: number | string) => ["delulu-visibility", String(id)] as const;

export function useDeluluVisibility(id: number | string | null | undefined, enabled = true) {
  return useQuery<VisibilityState | null>({
    queryKey: visibilityKey(id ?? "none"),
    enabled: enabled && id != null,
    staleTime: 30_000,
    queryFn: async () => {
      const res = await fetch(`/api/support/visibility?id=${id}`, { credentials: "same-origin" });
      if (res.status === 404 || res.status === 401) return null;
      if (!res.ok) throw new Error("Failed to load");
      return res.json();
    },
  });
}

/** Pill in the contract header: shows Public/Private, opens the settings sheet. */
export function VisibilityPill({ onChainId }: { onChainId: number }) {
  const { data } = useDeluluVisibility(onChainId);
  const [open, setOpen] = useState(false);
  if (!data) return null;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="press-edge rounded-full" aria-label="Who can see this">
        <HudPill className={data.isPublic ? "text-green-edge" : "text-muted-foreground"}>
          {data.isPublic ? <Globe2 className="h-[18px] w-[18px]" strokeWidth={2.2} /> : <Lock className="h-[18px] w-[18px]" strokeWidth={2.2} />}
          {data.isPublic ? "Public" : "Private"}
        </HudPill>
      </button>
      <VisibilitySheet open={open} onOpenChange={setOpen} onChainId={onChainId} state={data} />
    </>
  );
}

function VisibilitySheet({
  open,
  onOpenChange,
  onChainId,
  state,
}: {
  open: boolean;
  onOpenChange: (_o: boolean) => void;
  onChainId: number;
  state: VisibilityState;
}) {
  const queryClient = useQueryClient();
  const [isPublic, setIsPublic] = useState(state.isPublic);
  const [category, setCategory] = useState<SupportCategory>(
    (state.category ?? state.suggestedCategory) as SupportCategory,
  );
  const [blurb, setBlurb] = useState(state.publicDescription ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setIsPublic(state.isPublic);
    setCategory((state.category ?? state.suggestedCategory) as SupportCategory);
    setBlurb(state.publicDescription ?? "");
    setError(null);
  }, [open, state]);

  const lockedPrivate = !state.canBePublic && !state.isPublic;

  const save = async () => {
    setSaving(true);
    setError(null);
    const r = await postVisibility({
      id: onChainId,
      isPublic,
      ...(isPublic ? { category, publicDescription: blurb } : {}),
    });
    setSaving(false);
    if (!r.ok) {
      setError(r.error);
      return;
    }
    queryClient.setQueryData(visibilityKey(onChainId), r.data);
    void queryClient.invalidateQueries({ queryKey: ["support-feed"] });
    void queryClient.invalidateQueries({ queryKey: ["support-delulu", String(onChainId)] });
    onOpenChange(false);
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="Who can see this" modalClassName="max-w-md">
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-center gap-3 rounded-[20px] border-2 border-line bg-white px-4 py-3 shadow-edge">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", isPublic ? "bg-green-soft text-green-edge" : "bg-line text-ink")}>
            {isPublic ? <Globe2 className="h-5 w-5" /> : <Lock className="h-5 w-5" />}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-extrabold leading-tight">Open for support</div>
            <div className="label-mono mt-0.5 text-[10px] text-muted-foreground">
              {lockedPrivate ? "Only active Delulus" : isPublic ? "On the Support page" : "Only you"}
            </div>
          </div>
          <GameSwitch checked={isPublic} onChange={(v) => !lockedPrivate && setIsPublic(v)} label="Open for support" />
        </div>

        {isPublic ? (
          <>
            <div>
              <div className="label-mono mb-2 text-[10px] text-muted-foreground">Category</div>
              <div className="flex flex-wrap gap-2">
                {SUPPORT_CATEGORIES.map((c) => (
                  <Chip key={c} selected={category === c} onClick={() => setCategory(c)} className="h-9 px-3 text-[13px]">
                    {SUPPORT_CATEGORY_LABELS[c]}
                  </Chip>
                ))}
              </div>
            </div>
            <div>
              <label htmlFor="support-blurb" className="label-mono mb-2 block text-[10px] text-muted-foreground">
                Tell supporters why (optional)
              </label>
              <textarea
                id="support-blurb"
                value={blurb}
                maxLength={PUBLIC_DESCRIPTION_MAX}
                onChange={(e) => setBlurb(e.target.value)}
                rows={3}
                placeholder="Training for my first 10K…"
                className="w-full resize-none rounded-2xl border-2 border-line bg-white px-4 py-3 text-[15px] outline-none focus:border-ink"
              />
              <div className="mt-1 text-right text-[11px] text-muted-foreground tabular-nums">
                {blurb.length}/{PUBLIC_DESCRIPTION_MAX}
              </div>
            </div>
          </>
        ) : null}

        {error ? <p className="m-0 text-center text-sm font-semibold text-orange">{error}</p> : null}

        <GameButton full onClick={() => void save()} disabled={saving}>
          {saving ? "Saving…" : "Save"}
        </GameButton>
        {state.isPublic ? (
          <Link href={`/support/${onChainId}`} className="flex items-center justify-center gap-1.5 text-sm font-bold text-ink no-underline">
            See public page <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        ) : null}
      </div>
    </ResponsiveSheet>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Download, Share2 } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Lulu } from "@/components/ds";
import { useEarnFacts } from "@/hooks/use-earn-facts";
import { fireConfetti, showAppToast } from "@/lib/celebrate";
import { fmtNgn } from "@/lib/earn/format";
import type { BingoView } from "@/lib/bingo/view";

const seenKey = (attemptId: string) => `delulu:bingo-finished:${attemptId}`;

/** Whether this finished card's celebration has been shown on this device. */
export function finishSeen(attemptId: string): boolean {
  try {
    return localStorage.getItem(seenKey(attemptId)) === "1";
  } catch {
    return false;
  }
}

/**
 * The finish moment: Lulu cheering, what they kept and earned, and their card
 * as an image to share or download (title, their photos, Lulu, staydelulu.xyz).
 * Shown once per card — right when the last square fills, or on the next
 * visit if it confirmed later.
 */
export function BingoFinishSheet({
  bingo,
  open,
  onOpenChange,
}: {
  bingo: BingoView;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const me = bingo.me;
  const facts = useEarnFacts();
  const [busy, setBusy] = useState<"share" | "download" | null>(null);
  const required = bingo.missions.filter((m) => !m.bonus).length;
  const cashback = me ? (bingo.tiers.find((t) => t.key === me.tierKey)?.completionReward ?? 0) : 0;
  const ngn = (g: number) => (facts ? fmtNgn(g * facts.gdUsd * facts.ngnPerUsd) : null);
  const image = me ? `/api/og/bingo/${me.attemptId}` : null;

  useEffect(() => {
    if (!open || !me) return;
    void fireConfetti();
    try {
      localStorage.setItem(seenKey(me.attemptId), "1");
    } catch {
      /* storage blocked */
    }
  }, [open, me]);

  if (!me) return null;
  const text = `BINGO! 🎉 I kept all ${required} days of ${bingo.title} on Delulu`;
  // The link previews as this card (bingo/[slug]/page.tsx).
  const url = `${typeof window !== "undefined" ? window.location.origin : "https://www.staydelulu.xyz"}/bingo/${bingo.slug}?card=${me.attemptId}`;

  const cardFile = async () => {
    const res = await fetch(image!);
    if (!res.ok) throw new Error("card");
    return new File([await res.blob()], `delulu-${bingo.slug}.png`, { type: "image/png" });
  };
  const download = async (file?: File) => {
    const f = file ?? (await cardFile());
    const a = document.createElement("a");
    a.href = URL.createObjectURL(f);
    a.download = f.name;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const onShare = async () => {
    setBusy("share");
    try {
      const file = await cardFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: `${text} ${url}` });
      } else {
        await download(file);
        await navigator.clipboard.writeText(`${text} ${url}`).catch(() => {});
        showAppToast("Card saved · link copied");
      }
    } catch {
      /* cancelled */
    } finally {
      setBusy(null);
    }
  };
  const onDownload = async () => {
    setBusy("download");
    try {
      await download();
      showAppToast("Card saved");
    } catch {
      showAppToast("Couldn't save the card — try again");
    } finally {
      setBusy(null);
    }
  };

  return (
    <ResponsiveSheet open={open} onOpenChange={onOpenChange} title="You did it!" hideTitleVisually sheetClassName="rounded-t-3xl pb-10" modalClassName="max-w-md">
      <div className="flex flex-col items-center px-4 pb-2 pt-1 text-center">
        <span className="animate-bounce-in">
          <Lulu size={84} mood="kept" wave />
        </span>
        <p className="m-0 mt-2 font-display text-[30px] font-extrabold uppercase leading-none">Congratulations! 🎉</p>
        <p className="m-0 mt-2 text-[15px] font-semibold leading-snug text-muted-foreground">
          You kept all {required} days of <b className="text-ink">{bingo.title}</b>. Lulu is so proud of you.
        </p>

        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          <span className="rounded-full bg-green-soft px-3 py-1 text-[12px] font-extrabold text-green-edge">
            {me.stake.toLocaleString("en-US")} G$ back
          </span>
          {cashback > 0 ? (
            <span className="rounded-full bg-green-strong px-3 py-1 text-[12px] font-extrabold text-white">
              +{cashback.toLocaleString("en-US")} G$ cashback{ngn(cashback) ? ` ≈ ${ngn(cashback)}` : ""}
            </span>
          ) : null}
        </div>

        {image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image} alt={`${bingo.title} card`} className="mt-4 aspect-[4/5] w-full max-w-[300px] rounded-[22px] border-2 border-ink bg-paper object-cover shadow-[0_4px_0_#000]" />
        ) : null}

        <div className="mt-4 grid w-full grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void onShare()}
            className="press-edge flex h-12 items-center justify-center gap-2 rounded-2xl bg-yellow text-[14px] font-extrabold uppercase text-ink shadow-[0_3px_0_#b38f00] disabled:opacity-70"
          >
            <Share2 className="h-4 w-4" /> Share
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void onDownload()}
            className="press-edge flex h-12 items-center justify-center gap-2 rounded-2xl border-2 border-ink bg-white text-[14px] font-extrabold uppercase text-ink disabled:opacity-70"
          >
            <Download className="h-4 w-4" /> Download
          </button>
        </div>
        <button type="button" onClick={() => onOpenChange(false)} className="mt-2 h-10 text-[13px] font-bold text-muted-foreground">
          Done
        </button>
      </div>
    </ResponsiveSheet>
  );
}

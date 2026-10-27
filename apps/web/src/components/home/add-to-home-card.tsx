"use client";

import { useEffect, useState } from "react";
import { SquarePlus, X } from "lucide-react";
import { GameCard } from "@/components/ds";
import { AddToHomeSheet } from "@/components/pwa/add-to-home-sheet";
import { countVisitDay, detectDevice, isCardSnoozed, snoozeCard } from "@/lib/add-to-home";

/** Presentational card (see AddToHomeCard for when it shows). */
export function AddToHomeCardView({ onOpen, onHide }: { onOpen: () => void; onHide: () => void }) {
  return (
    <GameCard className="flex animate-rise items-center gap-3 py-3 pl-3.5 pr-2">
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 items-center gap-3 text-left">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-yellow-soft">
          <SquarePlus className="h-5 w-5" strokeWidth={2.4} />
        </span>
        <span className="min-w-0">
          <span className="block text-[15px] font-extrabold leading-tight">Add Delulu to your home screen</span>
          <span className="block text-xs text-muted-foreground">Opens full-screen, like an app</span>
        </span>
      </button>
      <button
        type="button"
        onClick={onHide}
        aria-label="Hide"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-ink"
      >
        <X className="h-4 w-4" />
      </button>
    </GameCard>
  );
}

/**
 * Home: a quiet "Add Delulu to your home screen" card, on phones only, from
 * the second day someone visits (day one is for getting started). ✕ hides it
 * for two weeks; opening Delulu from the home screen hides it for good.
 */
export function AddToHomeCard() {
  const [show, setShow] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  useEffect(() => {
    const visits = countVisitDay();
    const d = detectDevice();
    setShow(d.phone && !d.installed && visits >= 2 && !isCardSnoozed());
  }, []);

  if (!show) return null;

  const hide = () => {
    snoozeCard();
    setShow(false);
  };

  return (
    <>
      <AddToHomeCardView onOpen={() => setSheetOpen(true)} onHide={hide} />
      <AddToHomeSheet open={sheetOpen} onClose={() => setSheetOpen(false)} />
    </>
  );
}

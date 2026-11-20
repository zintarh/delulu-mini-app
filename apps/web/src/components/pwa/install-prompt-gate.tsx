"use client";

import { useEffect, useState } from "react";
import { AddToHomeSheet } from "@/components/pwa/add-to-home-sheet";
import { isMobileDevice, isStandalone } from "@/hooks/use-install-prompt";
import { useAuth } from "@/hooks/use-auth";
import { canAutoShow, takeAutoSlot, visitNumber } from "@/lib/overlay-slot";

const DISMISSED_KEY = "delulu:install-prompt-dismissed-at";
const WAIT_MS = 2 * 24 * 60 * 60 * 1000;

/** Fire this anywhere a reminder would matter now (e.g. right after joining a Bingo). */
export const SUGGEST_INSTALL_EVENT = "delulu:suggest-install";

export function suggestInstall(reason: "joined" | "proof" = "joined") {
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(SUGGEST_INSTALL_EVENT, { detail: { reason } }));
}

const COPY = {
  home: { title: "Get Delulu on your phone", subtitle: "Add it to your home screen — a heads-up before a day closes so your stake stays safe, and a ping when someone cheers your card." },
  joined: { title: "You're in! Now never miss a day", subtitle: "Add Delulu to your home screen so we can remind you before each day's square closes." },
  proof: { title: "Keep your streak safe", subtitle: "Add Delulu to your home screen — one tap to post, and a heads-up before tomorrow's square closes." },
} as const;

/**
 * Asks phone users who aren't on the installed app to add it to their home
 * screen — that's what lets reminders reach them. Opens on its own on Home
 * (at most every 2 days after a "not now"), and right away at the moments it
 * matters most (joined a Bingo, posted a proof).
 */
export function InstallPromptGate() {
  const { address } = useAuth();
  const [open, setOpen] = useState(false);
  const [copy, setCopy] = useState<(typeof COPY)[keyof typeof COPY]>(COPY.home);

  useEffect(() => {
    if (!address || !isMobileDevice() || isStandalone()) return;
    let dismissedAt = 0;
    try {
      dismissedAt = Number(localStorage.getItem(DISMISSED_KEY) ?? 0);
    } catch {
      /* storage blocked */
    }
    // Automatic: from the 2nd visit, at most one prompt a visit, never over the intro or gift.
    const visits = visitNumber();
    const t =
      visits >= 2 && Date.now() - dismissedAt > WAIT_MS
        ? window.setTimeout(() => {
            if (!canAutoShow("install")) return;
            takeAutoSlot("install");
            setOpen(true);
          }, 6000) // after the vote prompt has had its turn
        : undefined;
    const onSuggest = (e: Event) => {
      const reason = (e as CustomEvent<{ reason?: "joined" | "proof" }>).detail?.reason ?? "joined";
      setCopy(COPY[reason]);
      setOpen(true);
    };
    window.addEventListener(SUGGEST_INSTALL_EVENT, onSuggest);
    return () => {
      if (t) window.clearTimeout(t);
      window.removeEventListener(SUGGEST_INSTALL_EVENT, onSuggest);
    };
  }, [address]);

  const close = () => {
    setOpen(false);
    try {
      localStorage.setItem(DISMISSED_KEY, String(Date.now()));
    } catch {
      /* storage blocked */
    }
  };

  return <AddToHomeSheet open={open} onClose={close} title={copy.title} subtitle={copy.subtitle} />;
}

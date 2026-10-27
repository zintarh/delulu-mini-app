"use client";

/*
 * Add to home screen — device detection and the little bit of memory behind
 * the Home card (pattern borrowed from Bunkie's install flow). Delulu is a
 * web app: "installing" it just pins it to the home screen, so the copy says
 * exactly that.
 */

const KEY = "delulu.add-to-home.v1";
const DAY_MS = 24 * 3600 * 1000;
/** ✕ on the Home card hides it this long. */
export const CARD_SNOOZE_MS = 14 * DAY_MS;

type Store = { visits: number; lastVisit: string; cardHidden: number };

function readStore(): Store {
  const blank: Store = { visits: 0, lastVisit: "", cardHidden: 0 };
  try {
    return { ...blank, ...JSON.parse(window.localStorage.getItem(KEY) ?? "{}") };
  } catch {
    return blank;
  }
}

function writeStore(update: (_store: Store) => void) {
  try {
    const s = readStore();
    update(s);
    window.localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // Private mode / blocked storage: the card just won't remember.
  }
}

/** Counts distinct days visited; returns the running total. */
export function countVisitDay(): number {
  const today = new Date().toISOString().slice(0, 10);
  writeStore((s) => {
    if (s.lastVisit !== today) {
      s.visits += 1;
      s.lastVisit = today;
    }
  });
  return readStore().visits;
}

export function isCardSnoozed(): boolean {
  return Date.now() - readStore().cardHidden < CARD_SNOOZE_MS;
}

export function snoozeCard() {
  writeStore((s) => {
    s.cardHidden = Date.now();
  });
}

export type Device = {
  ios: boolean;
  android: boolean;
  phone: boolean;
  installed: boolean;
  /** WhatsApp, Instagram, … — their built-in browsers can't add to the home screen. */
  inApp: string | null;
  /** Chrome/Firefox/Edge on iPhone: Share lives in the address bar there. */
  iosNonSafari: boolean;
};

export function detectDevice(): Device {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const inApp = /WhatsApp/.test(ua)
    ? "WhatsApp"
    : /Instagram/.test(ua)
      ? "Instagram"
      : /FBAN|FBAV|FB_IAB/.test(ua)
        ? "Facebook"
        : /TikTok|musical_ly|BytedanceWebview/.test(ua)
          ? "TikTok"
          : /Telegram/.test(ua)
            ? "Telegram"
            : /Snapchat/.test(ua)
              ? "Snapchat"
              : /\bTwitter/.test(ua)
                ? "X"
                : null;
  const nav = navigator as Navigator & { standalone?: boolean };
  const installed = window.matchMedia?.("(display-mode: standalone)")?.matches === true || nav.standalone === true;
  return {
    ios,
    android,
    phone: ios || android,
    installed,
    inApp,
    iosNonSafari: ios && /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua),
  };
}

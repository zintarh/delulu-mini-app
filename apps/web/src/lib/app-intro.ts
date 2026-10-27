"use client";

import { useSyncExternalStore } from "react";

/*
 * First-run intro ("Say it. Stake it. Prove it.") — seen-once flag plus a tiny
 * store so other first-session modals (onboarding gift, email capture) wait
 * their turn instead of stacking on top of it.
 */

const KEY = "delulu.intro.v1";

export function hasSeenIntro(): boolean {
  try {
    return window.localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

/** null = not decided yet, "showing" = on screen, "done" = seen or not needed. */
type IntroState = null | "showing" | "done";
let state: IntroState = null;
const listeners = new Set<() => void>();

function set(next: IntroState) {
  state = next;
  listeners.forEach((l) => l());
}

export function markIntroShowing() {
  set("showing");
}

/** Seen, skipped, or not needed for this account — let the next modal through. */
export function markIntroDone() {
  try {
    window.localStorage.setItem(KEY, "1");
  } catch {
    // Private mode: it may show again next visit; nothing breaks.
  }
  set("done");
}

function snapshot(): IntroState {
  if (state === null && typeof window !== "undefined" && hasSeenIntro()) state = "done";
  return state;
}

function useIntroState(): IntroState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    snapshot,
    () => null,
  );
}

/** True once the intro is out of the way. Main-app first-run modals gate on this. */
export function useIntroDone(): boolean {
  return useIntroState() === "done";
}

/** True only while the intro is on screen — for modals mounted outside the main app too. */
export function useIntroShowing(): boolean {
  return useIntroState() === "showing";
}

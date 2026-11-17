"use client";

/*
 * One automatic pop-up per visit, in order — so nobody spends their first
 * minute closing things. First visit: intro → welcome gift (those already
 * wait for each other). From the second visit: the install sheet, then on a
 * later visit the notifications banner. Anything the person triggers
 * themselves (Verify, "you joined — add to home screen") skips this.
 */

const VISITS_KEY = "delulu:visits";
const VISIT_SESSION_KEY = "delulu:visit-counted";
const SLOT_SESSION_KEY = "delulu:auto-overlay";

const blocking = new Set<string>();

/** 1 on someone's first visit (this browser), 2 on the next, … Counted once per tab session. */
export function visitNumber(): number {
  try {
    let n = Number(localStorage.getItem(VISITS_KEY) ?? 0);
    if (!sessionStorage.getItem(VISIT_SESSION_KEY)) {
      n += 1;
      localStorage.setItem(VISITS_KEY, String(n));
      sessionStorage.setItem(VISIT_SESSION_KEY, "1");
    }
    return Math.max(1, n);
  } catch {
    return 1;
  }
}

/** A must-see modal (intro, gift) is open — automatic prompts wait. */
export function setBlockingOverlay(name: string, open: boolean) {
  if (open) blocking.add(name);
  else blocking.delete(name);
}

/**
 * May an automatic prompt `name` show now? Only one per visit, never over a
 * must-see modal, and not on the first visit.
 */
export function canAutoShow(name: string): boolean {
  if (blocking.size > 0) return false;
  if (visitNumber() < 2) return false;
  try {
    const taken = sessionStorage.getItem(SLOT_SESSION_KEY);
    return !taken || taken === name;
  } catch {
    return true;
  }
}

/** Claim this visit's one automatic prompt. */
export function takeAutoSlot(name: string) {
  try {
    sessionStorage.setItem(SLOT_SESSION_KEY, name);
  } catch {
    /* storage blocked */
  }
}

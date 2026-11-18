/**
 * Turning G$ into naira — done by hand over Telegram, not in the app.
 * Shown on the How to earn page.
 */

/** Smallest amount we convert — low enough that a new player's First Week earnings qualify. */
export const NAIRA_CASHOUT_MIN_G = 5_000;

/**
 * Who to message on Telegram to convert G$ to naira. Null hides the button
 * (the page still explains the minimum).
 */
export const NAIRA_CASHOUT_TELEGRAM_URL: string | null = "https://t.me/zintarh";

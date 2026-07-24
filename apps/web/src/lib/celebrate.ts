type ConfettiFn = ((options?: Record<string, unknown>) => Promise<null> | null) & {
  (options?: Record<string, unknown>): Promise<null> | null;
};

async function loadConfetti(): Promise<ConfettiFn | null> {
  try {
    const mod = await import("canvas-confetti");
    const candidate =
      (mod as { default?: unknown }).default ?? (mod as unknown);
    return typeof candidate === "function" ? (candidate as ConfettiFn) : null;
  } catch {
    return null;
  }
}

const REWARD_COLORS = ["#f6c324", "#4f46e5", "#35d07f", "#ffffff", "#38bdf8"];

/** Burst celebration used after successful claims / joins. */
export async function fireConfetti() {
  if (typeof window === "undefined") return;
  const confetti = await loadConfetti();
  if (!confetti) return;

  confetti({
    particleCount: 120,
    spread: 80,
    startVelocity: 45,
    origin: { y: 0.55 },
    zIndex: 9999,
    colors: REWARD_COLORS,
  });

  // Second side bursts so it’s hard to miss on mobile.
  window.setTimeout(() => {
    confetti({
      particleCount: 60,
      angle: 60,
      spread: 55,
      origin: { x: 0, y: 0.65 },
      zIndex: 9999,
      colors: REWARD_COLORS,
    });
    confetti({
      particleCount: 60,
      angle: 120,
      spread: 55,
      origin: { x: 1, y: 0.65 },
      zIndex: 9999,
      colors: REWARD_COLORS,
    });
  }, 180);
}

export const APP_TOAST_EVENT = "delulu:app-toast";

export function showAppToast(message: string) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(APP_TOAST_EVENT, { detail: { message } }));
}

/** Brief celebration after joining a community campaign. */
export async function celebrateCampaignJoin(campaignTitle?: string) {
  if (typeof window === "undefined") return;
  void fireConfetti();
  showAppToast(
    campaignTitle ? `You're in — ${campaignTitle}` : "You're in the campaign!",
  );
  await new Promise((resolve) => setTimeout(resolve, 450));
}

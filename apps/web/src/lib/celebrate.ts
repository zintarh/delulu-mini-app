export async function fireConfetti() {
  try {
    const confettiModule = await import("canvas-confetti");
    const confetti = ((confettiModule as unknown as { default?: unknown }).default ??
      confettiModule) as unknown;
    if (typeof confetti === "function") {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.35 },
        colors: ["#f6c324", "#4f46e5", "#35d07f", "#ffffff"],
      });
    }
  } catch {
    // optional visual
  }
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

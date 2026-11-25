export type GasClientResult = {
  success: boolean;
  reason?: string;
  message?: string;
  amountCelo?: number;
  pending?: boolean;
};

let inflight: Promise<GasClientResult> | null = null;

/** One in-flight drip. A second tap waits on the same request instead of double-sending. */
export function requestGasTopup(captchaToken?: string | null): Promise<GasClientResult> {
  if (!inflight) {
    inflight = fetch("/api/faucet/topup", {
      method: "POST",
      credentials: "include",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ captchaToken: captchaToken ?? null }),
    })
      .then(async (r) => {
        const data = (await r.json().catch(() => null)) as GasClientResult | null;
        if (!data || typeof data.success !== "boolean") {
          return { success: false, reason: "unavailable", message: "Couldn't send gas right now. Try again." };
        }
        return data;
      })
      .catch(() => ({ success: false, reason: "unavailable", message: "Couldn't reach the faucet. Try again." }))
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

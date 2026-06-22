import { buildWalletAuthMessage } from "@/lib/auth/wallet-auth-message";

type SignProvider = {
  request: (args: { method: string; params: unknown[] }) => Promise<string>;
};

/** Module-level cache so every useAuth() instance shares one session check/sign. */
let establishedAddress: string | null = null;
let inFlight: Promise<boolean> | null = null;
let inFlightAddress: string | null = null;

async function hasValidWalletSession(expectedAddress: string): Promise<boolean> {
  try {
    const res = await fetch("/api/auth/wallet-session", { credentials: "include" });
    if (!res.ok) return false;
    const data = (await res.json()) as { authenticated?: boolean; address?: string };
    return (
      data.authenticated === true &&
      typeof data.address === "string" &&
      data.address.toLowerCase() === expectedAddress.toLowerCase()
    );
  } catch {
    return false;
  }
}

/**
 * Ensures an httpOnly wallet session cookie exists for API auth.
 * Skips personal_sign when a valid session already exists for this address.
 */
export async function establishWalletSession(
  address: string,
  provider: SignProvider,
): Promise<boolean> {
  const normalized = address.toLowerCase();

  if (establishedAddress === normalized) return true;

  if (await hasValidWalletSession(normalized)) {
    establishedAddress = normalized;
    return true;
  }

  if (inFlight && inFlightAddress === normalized) {
    return inFlight;
  }

  inFlightAddress = normalized;
  inFlight = (async () => {
    try {
      const message = buildWalletAuthMessage(address);
      const signature = await provider.request({
        method: "personal_sign",
        params: [message, address],
      });
      const res = await fetch("/api/auth/wallet-session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ address, message, signature }),
      });
      if (res.ok) {
        establishedAddress = normalized;
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      inFlight = null;
      inFlightAddress = null;
    }
  })();

  return inFlight;
}

export function clearWalletSessionClientState(): void {
  establishedAddress = null;
  inFlight = null;
  inFlightAddress = null;
}

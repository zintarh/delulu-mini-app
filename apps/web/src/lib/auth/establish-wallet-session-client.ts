import { buildWalletAuthMessage } from "@/lib/auth/wallet-auth-message";

type SignProvider = {
  request: (args: { method: string; params: unknown[] }) => Promise<string>;
};

/** Module-level cache so every caller shares one session check/sign. */
let establishedAddress: string | null = null;
let inFlight: Promise<boolean> | null = null;
let inFlightAddress: string | null = null;
/** Last signed payload — retry POST without re-prompting if the wallet already signed. */
let pendingAuth: {
  address: string;
  message: string;
  signature: string;
} | null = null;
/** User rejected personal_sign — do not auto-prompt again until logout. */
const signDeclinedAddresses = new Set<string>();

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

async function postWalletSession(
  address: string,
  message: string,
  signature: string,
): Promise<boolean> {
  const res = await fetch("/api/auth/wallet-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ address, message, signature }),
  });
  return res.ok;
}

/**
 * Ensures an httpOnly wallet session cookie exists for API auth.
 * Skips personal_sign when a valid session already exists for this address.
 * Deduplicates concurrent calls and never re-prompts after user decline.
 */
export async function establishWalletSession(
  address: string,
  provider: SignProvider,
): Promise<boolean> {
  const normalized = address.toLowerCase();

  if (establishedAddress === normalized) return true;

  if (signDeclinedAddresses.has(normalized)) return false;

  if (inFlight && inFlightAddress === normalized) {
    return inFlight;
  }

  const run = async (): Promise<boolean> => {
    try {
      if (establishedAddress === normalized) return true;
      if (signDeclinedAddresses.has(normalized)) return false;

      if (await hasValidWalletSession(normalized)) {
        establishedAddress = normalized;
        pendingAuth = null;
        return true;
      }

      let message: string;
      let signature: string;

      if (
        pendingAuth &&
        pendingAuth.address === normalized
      ) {
        ({ message, signature } = pendingAuth);
      } else {
        message = buildWalletAuthMessage(address);
        try {
          signature = await provider.request({
            method: "personal_sign",
            params: [message, address],
          });
        } catch {
          signDeclinedAddresses.add(normalized);
          pendingAuth = null;
          return false;
        }
        pendingAuth = { address: normalized, message, signature };
      }

      const ok = await postWalletSession(address, message, signature);
      if (ok) {
        establishedAddress = normalized;
        pendingAuth = null;
        return true;
      }

      return false;
    } catch {
      return false;
    }
  };

  inFlightAddress = normalized;
  inFlight = run().finally(() => {
    if (inFlightAddress === normalized) {
      inFlight = null;
      inFlightAddress = null;
    }
  });

  return inFlight;
}

export function clearWalletSessionClientState(): void {
  establishedAddress = null;
  inFlight = null;
  inFlightAddress = null;
  pendingAuth = null;
  signDeclinedAddresses.clear();
}

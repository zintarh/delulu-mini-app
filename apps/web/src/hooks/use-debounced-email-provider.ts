"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { isValidEmail, normalizeEmail } from "@/lib/email-validation";
import {
  lookupEmailProvider,
  peekCachedEmailCheck,
  pickAuthProvider,
  type ProfileAuthProvider,
} from "@/lib/email-provider-lookup";

const NETWORK_TIMEOUT_MS = 5000;

type Resolved = {
  email: string;
  provider: Exclude<ProfileAuthProvider, null>;
};

/**
 * Resolves which auth provider (Privy or Web3Auth) owns an email at submit
 * time, reusing the in-memory lookup cache and the last resolution when the
 * email hasn't changed.
 */
export function useDebouncedEmailProvider(email: string) {
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const emailIsValid = useMemo(() => isValidEmail(email), [email]);

  const [isChecking, setIsChecking] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  /** Always returns a provider; reuses cache / prior resolution when possible. */
  const resolveForSubmit = useCallback(async (): Promise<"privy" | "web3auth"> => {
    if (!emailIsValid) return "web3auth";

    if (resolved?.email === normalizedEmail) {
      return resolved.provider;
    }

    const cached = peekCachedEmailCheck(normalizedEmail);
    if (cached) return pickAuthProvider(cached);

    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;
    const networkTimeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
    setIsChecking(true);

    try {
      const result = await lookupEmailProvider(normalizedEmail, controller.signal);
      const provider = pickAuthProvider(result);
      setResolved({ email: normalizedEmail, provider });
      return provider;
    } catch {
      // Do NOT silently fall back to "web3auth" here — an existing Privy user whose
      // lookup times out would be routed into Web3Auth and get a brand-new address,
      // losing their GoodDollar-whitelisted wallet. Throw so the caller can surface
      // a connection error and let the user retry instead.
      throw new Error("Couldn't verify your account — check your connection and try again.");
    } finally {
      clearTimeout(networkTimeout);
      setIsChecking(false);
    }
  }, [emailIsValid, normalizedEmail, resolved]);

  return { isChecking, resolveForSubmit };
}

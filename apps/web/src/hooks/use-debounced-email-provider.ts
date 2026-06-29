"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isValidEmail, normalizeEmail } from "@/lib/email-validation";
import {
  lookupEmailProvider,
  peekCachedEmailCheck,
  pickAuthProvider,
  type ProfileAuthProvider,
} from "@/lib/email-provider-lookup";

const DEFAULT_DEBOUNCE_MS = 400;
const NETWORK_TIMEOUT_MS = 5000;

type Resolved = {
  email: string;
  provider: Exclude<ProfileAuthProvider, null>;
};

/**
 * Prefetch auth provider for a valid email while the user types (debounced),
 * with an in-memory cache and an immediate flush on blur.
 */
export function useDebouncedEmailProvider(
  email: string,
  debounceMs = DEFAULT_DEBOUNCE_MS,
) {
  const normalizedEmail = useMemo(() => normalizeEmail(email), [email]);
  const emailIsValid = useMemo(() => isValidEmail(email), [email]);

  const [isChecking, setIsChecking] = useState(false);
  const [resolved, setResolved] = useState<Resolved | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const applyCached = useCallback((target: string) => {
    const cached = peekCachedEmailCheck(target);
    if (!cached) return false;
    setResolved({ email: target, provider: pickAuthProvider(cached) });
    return true;
  }, []);

  const runLookup = useCallback(
    async (target: string) => {
      if (!isValidEmail(target)) {
        setResolved(null);
        return;
      }

      if (applyCached(target)) return;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;
      const requestId = ++requestIdRef.current;

      const networkTimeout = setTimeout(() => controller.abort(), NETWORK_TIMEOUT_MS);
      setIsChecking(true);

      try {
        const result = await lookupEmailProvider(target, controller.signal);
        if (requestId !== requestIdRef.current) return;
        setResolved({ email: target, provider: pickAuthProvider(result) });
      } catch {
        if (requestId !== requestIdRef.current) return;
        // Submit path can retry; keep prior resolution if still the same email.
      } finally {
        clearTimeout(networkTimeout);
        if (requestId === requestIdRef.current) {
          setIsChecking(false);
        }
      }
    },
    [applyCached],
  );

  const cancelScheduled = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
  }, []);

  const scheduleLookup = useCallback(
    (target: string) => {
      cancelScheduled();

      if (!isValidEmail(target)) {
        setResolved(null);
        setIsChecking(false);
        return;
      }

      if (resolved?.email === target || applyCached(target)) {
        setIsChecking(false);
        return;
      }

      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        void runLookup(target);
      }, debounceMs);
    },
    [applyCached, cancelScheduled, debounceMs, resolved?.email, runLookup],
  );

  /** Run immediately — call from input `onBlur` when the user commits an address. */
  const flushLookup = useCallback(() => {
    cancelScheduled();
    abortRef.current?.abort();
    if (!emailIsValid) {
      setResolved(null);
      setIsChecking(false);
      return;
    }
    void runLookup(normalizedEmail);
  }, [cancelScheduled, emailIsValid, normalizedEmail, runLookup]);

  /** Always returns a provider; reuses cache / prior resolution when possible. */
  const resolveForSubmit = useCallback(async (): Promise<"privy" | "web3auth"> => {
    if (!emailIsValid) return "web3auth";

    if (resolved?.email === normalizedEmail) {
      return resolved.provider;
    }

    const cached = peekCachedEmailCheck(normalizedEmail);
    if (cached) return pickAuthProvider(cached);

    cancelScheduled();
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
      return "web3auth";
    } finally {
      clearTimeout(networkTimeout);
      setIsChecking(false);
    }
  }, [cancelScheduled, emailIsValid, normalizedEmail, resolved]);

  useEffect(() => {
    scheduleLookup(normalizedEmail);
    return () => {
      cancelScheduled();
      abortRef.current?.abort();
    };
  }, [cancelScheduled, normalizedEmail, scheduleLookup]);

  return {
    isChecking,
    resolvedProvider: resolved?.provider ?? null,
    resolvedEmail: resolved?.email ?? "",
    flushLookup,
    resolveForSubmit,
  };
}

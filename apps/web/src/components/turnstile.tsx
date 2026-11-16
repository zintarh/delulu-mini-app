"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef } from "react";

type TurnstileApi = {
  render: (_el: HTMLElement, _opts: Record<string, unknown>) => string;
  reset: (_id: string) => void;
  remove: (_id: string) => void;
};

/** Another dependency already types window.turnstile differently; read it through this. */
const api = (): TurnstileApi | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { turnstile?: TurnstileApi }).turnstile;

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
let scriptPromise: Promise<void> | null = null;

function loadScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (api()) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.defer = true;
      s.onload = () => resolve();
      s.onerror = () => {
        scriptPromise = null;
        reject(new Error("Turnstile failed to load"));
      };
      document.head.appendChild(s);
    });
  }
  return scriptPromise;
}

export type TurnstileHandle = { reset: () => void };

/**
 * Cloudflare Turnstile, "interaction-only": invisible unless Cloudflare wants
 * a click. Renders nothing when NEXT_PUBLIC_TURNSTILE_SITE_KEY isn't set.
 * Tokens are single-use, so call reset() after each request that used one.
 */
export const Turnstile = forwardRef<TurnstileHandle, { onToken: (_token: string | null) => void; className?: string }>(
  function Turnstile({ onToken, className }, ref) {
    const el = useRef<HTMLDivElement>(null);
    const widget = useRef<string | null>(null);
    const onTokenRef = useRef(onToken);
    onTokenRef.current = onToken;

    useImperativeHandle(ref, () => ({
      reset: () => {
        onTokenRef.current(null);
        const t = api();
        if (widget.current && t) t.reset(widget.current);
      },
    }));

    useEffect(() => {
      if (!TURNSTILE_SITE_KEY || !el.current) return;
      let cancelled = false;
      loadScript()
        .then(() => {
          const t = api();
          if (cancelled || !el.current || !t) return;
          widget.current = t.render(el.current, {
            sitekey: TURNSTILE_SITE_KEY,
            appearance: "interaction-only",
            callback: (t: string) => onTokenRef.current(t),
            "expired-callback": () => onTokenRef.current(null),
            "error-callback": () => onTokenRef.current(null),
          });
        })
        .catch(() => onTokenRef.current(null));
      return () => {
        cancelled = true;
        const t = api();
        if (widget.current && t) t.remove(widget.current);
        widget.current = null;
      };
    }, []);

    if (!TURNSTILE_SITE_KEY) return null;
    return <div ref={el} className={className} />;
  },
);

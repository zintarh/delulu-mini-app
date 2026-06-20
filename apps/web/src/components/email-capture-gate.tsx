"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { Loader2, Mail } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserStore } from "@/stores/useUserStore";
import {
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@/components/ui/modal";
import { cn } from "@/lib/utils";

const DISMISS_KEY = "delulu_email_prompt_dismissed_v1";

function isExcludedPath(pathname: string): boolean {
  if (pathname.startsWith("/sign-in")) return true;
  if (pathname.startsWith("/welcome")) return true;
  if (pathname.startsWith("/dashboard")) return true;
  return false;
}

function isPlaceholderEmail(email: string | null | undefined): boolean {
  if (!email || !email.includes("@")) return true;
  return email.trim().toLowerCase().endsWith("@wallet.local");
}

function readDismissedSet(): Set<string> {
  try {
    const raw = window.sessionStorage.getItem(DISMISS_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return new Set();
    return new Set(arr.map((a) => String(a).toLowerCase()));
  } catch {
    return new Set();
  }
}

function writeDismissed(address: string) {
  try {
    const set = readDismissedSet();
    set.add(address.toLowerCase());
    window.sessionStorage.setItem(DISMISS_KEY, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
}

type ProfileRow = { email: string | null; username: string | null } | null;

/**
 * After auth, if Supabase profile exists but email is missing or @wallet.local,
 * prompt once per session (dismissible) to add a real email for rewards & updates.
 */
export function EmailCaptureGate() {
  const pathname = usePathname();
  const { authenticated, address, isReady, email: authProviderEmail } = useAuth();
  const updateProfile = useUserStore((s) => s.updateProfile);

  const [profile, setProfile] = useState<ProfileRow | undefined>(undefined);
  const [open, setOpen] = useState(false);
  const [localDismissed, setLocalDismissed] = useState(false);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const closedAfterSuccessRef = useRef(false);

  const excluded = isExcludedPath(pathname ?? "");

  const loadProfile = useCallback(async () => {
    if (!address) {
      setProfile(undefined);
      return;
    }
    setProfile(undefined);
    try {
      const res = await fetch(`/api/profile/${address.toLowerCase()}`, { cache: "no-store" });
      if (!res.ok) {
        setProfile(null);
        return;
      }
      const json = await res.json();
      const p = json.profile as { email?: string | null; username?: string | null } | null;
      if (!p) {
        setProfile(null);
        return;
      }
      setProfile({ email: p.email ?? null, username: p.username ?? null });
    } catch {
      setProfile(null);
    }
  }, [address]);

  useEffect(() => {
    if (!authenticated || !address || !isReady) {
      setProfile(undefined);
      setOpen(false);
      return;
    }
    void loadProfile();
  }, [authenticated, address, isReady, loadProfile]);

  useEffect(() => {
    if (typeof authProviderEmail === "string" && authProviderEmail.includes("@")) {
      setInput((prev) => (prev.trim() === "" ? authProviderEmail : prev));
    }
  }, [authProviderEmail]);

  useEffect(() => {
    setLocalDismissed(false);
  }, [address]);

  const needsEmail = useMemo(() => {
    if (profile === undefined || profile === null) return false;
    return isPlaceholderEmail(profile.email);
  }, [profile]);

  useEffect(() => {
    if (excluded || !authenticated || !address || !isReady) {
      setOpen(false);
      return;
    }
    if (profile === undefined || profile === null) {
      setOpen(false);
      return;
    }
    if (!needsEmail || localDismissed) {
      setOpen(false);
      return;
    }
    if (address && readDismissedSet().has(address.toLowerCase())) {
      setOpen(false);
      return;
    }
    setOpen(true);
  }, [excluded, authenticated, address, isReady, profile, needsEmail, localDismissed]);

  const handleDismiss = () => {
    if (address) writeDismissed(address);
    setLocalDismissed(true);
    setOpen(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return;
    const trimmed = input.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Enter a valid email address.");
      return;
    }
    if (trimmed.endsWith("@wallet.local")) {
      setError("Use a real inbox address (not a wallet placeholder).");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/profile/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: address.toLowerCase(), email: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(typeof json.error === "string" ? json.error : "Could not save email.");
        return;
      }
      closedAfterSuccessRef.current = true;
      updateProfile({ email: trimmed });
      setProfile((prev) => (prev ? { ...prev, email: trimmed } : prev));
      setOpen(false);
      queueMicrotask(() => {
        closedAfterSuccessRef.current = false;
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onOpenChange={(nextOpen) => {
        if (nextOpen) {
          setOpen(true);
          return;
        }
        if (closedAfterSuccessRef.current) {
          setOpen(false);
          return;
        }
        handleDismiss();
      }}
    >
      <ModalContent className="max-w-md" showClose>
        <ModalHeader>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-muted border border-border mb-1">
            <Mail className="h-5 w-5 text-foreground" />
          </div>
          <ModalTitle className="text-left text-lg font-black tracking-tight">
            Add your email
          </ModalTitle>
          <ModalDescription className="text-left text-sm text-muted-foreground leading-relaxed">
            We use your email to share future rewards, product updates, and important notices about
            your goals. It is not shown publicly.
          </ModalDescription>
        </ModalHeader>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="delulu-email-capture" className="sr-only">
              Email
            </label>
            <input
              id="delulu-email-capture"
              type="email"
              autoComplete="email"
              value={input}
              onChange={(ev) => setInput(ev.target.value)}
              placeholder="you@example.com"
              className={cn(
                "w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm",
                "outline-none focus-visible:ring-2 focus-visible:ring-ring",
              )}
            />
            {error && <p className="mt-1.5 text-xs text-destructive font-medium">{error}</p>}
          </div>
          <ModalFooter className="flex-col gap-2 sm:flex-col pt-1">
            <button
              type="submit"
              disabled={submitting || !input.trim()}
              className={cn(
                "w-full h-11 rounded-xl border-2 text-sm font-black",
                "border-delulu-charcoal bg-delulu-yellow-reserved text-delulu-charcoal",
                "shadow-[2px_2px_0px_0px_#1a1a19] hover:brightness-95 transition-all",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "inline-flex items-center justify-center gap-2",
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save email
            </button>
            <button
              type="button"
              onClick={handleDismiss}
              className="w-full py-2 text-xs font-semibold text-muted-foreground hover:text-foreground"
            >
              Not now
            </button>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}

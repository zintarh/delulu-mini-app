"use client";

import React, { useState } from "react";
import { Mail } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { useUserStore } from "@/stores/useUserStore";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface AddEmailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AddEmailSheet({ open, onOpenChange }: AddEmailSheetProps) {
  const { address } = useAuth();
  const { updateProfile } = useUserStore();
  const [emailInput, setEmailInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address || !emailInput.trim()) return;

    const trimmed = emailInput.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address, email: trimmed }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Failed to save email.");

      updateProfile({ email: trimmed });
      setEmailInput("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add email"
      sheetClassName="border-t border-border !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      modalClassName="max-w-lg"
    >
      <div className="max-w-lg mx-auto px-6 pt-4 pb-8">
        <div className="flex items-center justify-center w-12 h-12 rounded-full bg-muted/40 mb-4 mx-auto">
          <Mail className="w-5 h-5 text-muted-foreground" />
        </div>
        <p
          className="text-sm text-muted-foreground text-center mb-6 leading-relaxed"
          style={{ fontFamily: "var(--font-manrope)" }}
        >
          We&apos;ll send you reminders when your milestones are about to end so you never miss a deadline.
        </p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="email"
            value={emailInput}
            onChange={(e) => {
              setEmailInput(e.target.value);
              setError(null);
            }}
            placeholder="you@example.com"
            autoComplete="email"
            disabled={isSubmitting}
            className="w-full px-4 py-3 rounded-xl bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-border"
            style={{ fontFamily: "var(--font-manrope)" }}
          />
          {error && (
            <p
              className="text-xs text-rose-400"
              style={{ fontFamily: "var(--font-manrope)" }}
            >
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={isSubmitting || !emailInput.trim()}
            className={cn(
              "w-full py-3 rounded-xl text-sm font-bold transition-all",
              isSubmitting || !emailInput.trim()
                ? "bg-secondary text-muted-foreground cursor-not-allowed"
                : "bg-delulu-yellow text-delulu-charcoal hover:brightness-105 active:scale-[0.99]"
            )}
            style={{ fontFamily: "var(--font-manrope)" }}
          >
            {isSubmitting ? "Saving…" : "Save email"}
          </button>
        </form>
      </div>
    </ResponsiveSheet>
  );
}

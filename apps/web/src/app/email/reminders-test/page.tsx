"use client";

import { FormEvent, useState } from "react";
import { Loader2, MailCheck, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";

export default function ReminderEmailTestPage() {
  const { address } = useAuth();
  const [to, setTo] = useState("");
  const [username, setUsername] = useState("Visionary");
  const [secret, setSecret] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!to.trim() || !secret.trim() || !address) {
      setError("Email, secret, and connected wallet are required.");
      setResult(null);
      return;
    }

    setIsSending(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/email/reminders/test", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${secret.trim()}`,
        },
        body: JSON.stringify({
          to: to.trim(),
          username: username.trim() || "Visionary",
          address,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Failed to send test email.");
        return;
      }
      setResult(`Test email sent to ${data?.sentTo ?? to.trim()}.`);
    } catch {
      setError("Network error while sending test email.");
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-background px-4 py-10">
      <div className="mx-auto w-full max-w-xl">
        <div className="mb-6">
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Reminder Email Test
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Send yourself a real reminder preview using your active delulus and milestones ending within 24 hours.
          </p>
        </div>
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Connected Wallet
            </span>
            <input
              type="text"
              value={address ?? ""}
              readOnly
              placeholder="Connect wallet to load active delulus"
              className="w-full rounded-xl border border-border bg-muted/40 px-3 py-2.5 text-sm outline-none"
            />
          </label>


        <form
          onSubmit={onSubmit}
          className="rounded-2xl border border-border bg-card p-5 shadow-sm space-y-4"
        >
          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Recipient Email
            </span>
            <input
              type="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Username (optional)
            </span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Visionary"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
            />
          </label>

          <label className="block space-y-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Cron Secret
            </span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              placeholder="CRON_SECRET"
              className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-foreground/40"
            />
          </label>

          <button
            type="submit"
            disabled={isSending}
            className={cn(
              "w-full inline-flex items-center justify-center gap-2 rounded-xl border border-foreground/90 bg-foreground py-3 text-sm font-semibold text-background",
              "hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed",
            )}
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Test Email
              </>
            )}
          </button>

          {result && (
            <div className="flex items-start gap-2 rounded-xl border border-emerald-500/50 bg-emerald-500/10 px-3 py-2.5 text-sm text-emerald-700 dark:text-emerald-300">
              <MailCheck className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{result}</span>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-destructive/60 bg-destructive/10 px-3 py-2.5 text-sm text-destructive">
              {error}
            </div>
          )}
        </form>
      </div>
    </div>
  );
}


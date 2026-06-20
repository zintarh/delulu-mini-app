"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";
import { DashboardAuthCard } from "@/components/dashboard/dashboard-auth-card";
import {
  DashboardField,
  DashboardPrimaryButton,
  dashboardInputClass,
} from "@/components/dashboard/dashboard-ui";

function AcceptInviteForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return <p className="text-center text-sm text-destructive">Invalid invite link.</p>;
  }

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/invites/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, displayName: displayName.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Failed to accept invite.");
        return;
      }
      setSuccess(true);
      setTimeout(() => router.replace(json.redirect ?? "/dashboard"), 1500);
    } catch {
      setError("Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  };

  if (success) {
    return (
      <div className="flex flex-col items-center gap-2 py-6">
        <CheckCircle className="h-10 w-10 text-emerald-600" />
        <p className="text-sm font-semibold">Redirecting…</p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <DashboardField label="Name">
        <input
          type="text"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          className={dashboardInputClass}
        />
      </DashboardField>

      <DashboardField label="Password" required>
        <input
          type="password"
          required
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={dashboardInputClass}
        />
      </DashboardField>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <DashboardPrimaryButton
        type="submit"
        disabled={submitting || !password}
        className="w-full py-3"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
        Create account
      </DashboardPrimaryButton>
    </form>
  );
}

export default function AcceptInvitePage() {
  return (
    <DashboardAuthCard title="Accept invite" backHref="/signin">
      <Suspense
        fallback={
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        }
      >
        <AcceptInviteForm />
      </Suspense>
    </DashboardAuthCard>
  );
}

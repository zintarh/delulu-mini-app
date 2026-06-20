"use client";

import { FormEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { DashboardAuthCard } from "@/components/dashboard/dashboard-auth-card";
import { DashboardField, dashboardInputClass } from "@/components/dashboard/dashboard-ui";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next");
  const destination =
    nextPath && nextPath.startsWith("/dashboard") && nextPath !== "/signin"
      ? nextPath
      : "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/dashboard/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), password }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(json?.error ?? "Login failed.");
        return;
      }
      router.replace(destination);
    } catch {
      setError("Unable to login right now.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <DashboardAuthCard title="Sign in">
      <form onSubmit={onSubmit} className="space-y-5">
        <DashboardField label="Email" required>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={dashboardInputClass}
            placeholder="you@example.com"
          />
        </DashboardField>
        <DashboardField label="Password" required>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={dashboardInputClass}
          />
        </DashboardField>

        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <button
          type="submit"
          disabled={isSubmitting}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-delulu-blue py-3 text-sm font-semibold text-white hover:bg-delulu-blue/90 disabled:opacity-60"
        >
          {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue
        </button>
      </form>
    </DashboardAuthCard>
  );
}

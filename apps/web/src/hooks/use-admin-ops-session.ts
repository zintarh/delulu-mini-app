"use client";

import { useEffect, useState } from "react";

type AdminOpsState = {
  configured: boolean;
  authenticated: boolean;
  email: string | null;
};

export function useAdminOpsSession() {
  const [state, setState] = useState<AdminOpsState>({
    configured: false,
    authenticated: false,
    email: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await fetch("/api/admin/auth/me", { cache: "no-store" });
        if (!res.ok) throw new Error("Failed to read admin session");
        const json = await res.json();
        if (!mounted) return;
        setState({
          configured: Boolean(json?.configured),
          authenticated: Boolean(json?.authenticated),
          email: json?.session?.email ?? null,
        });
      } catch {
        if (!mounted) return;
        setState({ configured: false, authenticated: false, email: null });
      } finally {
        if (mounted) setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { ...state, isLoading };
}


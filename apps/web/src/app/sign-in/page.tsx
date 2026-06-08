"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import {
  consumeSignInRedirect,
  persistSignInRedirect,
  safeRedirectPath,
} from "@/lib/auth-redirect";

export default function SignInPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { authenticated, address } = useAuth();

  useEffect(() => {
    persistSignInRedirect(searchParams.get("redirect"));
  }, [searchParams]);

  useEffect(() => {
    if (authenticated && address) {
      const redirectTarget =
        consumeSignInRedirect() ?? safeRedirectPath(searchParams.get("redirect"));
      router.replace(redirectTarget ?? "/");
    }
  }, [authenticated, address, router, searchParams]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
    </div>
  );
}

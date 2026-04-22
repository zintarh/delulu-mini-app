"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/hooks/use-auth";
import { useUsernameByAddress } from "@/hooks/use-username-by-address";

const UNGUARDED_PATHS = ["/setup-profile"];

export function ProfileGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { authenticated, isReady: ready, address } = useAuth();
  const { username, isLoading } = useUsernameByAddress(
    address as `0x${string}` | undefined
  );

  const isUnguarded = UNGUARDED_PATHS.some((p) => pathname.startsWith(p));

  // Authenticated user with no username → force setup
  useEffect(() => {
    if (!ready || isLoading) return;
    if (isUnguarded) return;
    if (!authenticated || !address) return;
    if (!username) {
      router.replace("/setup-profile");
    }
  }, [ready, authenticated, address, username, isLoading, isUnguarded, router]);

  // Already set up → leave setup page
  useEffect(() => {
    if (!ready || isLoading) return;
    if (!isUnguarded) return;
    if (!authenticated || !address) return;
    if (username) {
      router.replace("/");
    }
  }, [ready, authenticated, address, username, isLoading, isUnguarded, router]);

  return <>{children}</>;
}

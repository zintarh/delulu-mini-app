"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useReadContract } from "wagmi";
import { AppLoader } from "@/components/app-loader";
import { useAuth } from "@/hooks/use-auth";
import { useStoredUsername } from "@/hooks/use-stored-username";
import { DELULU_ABI } from "@/lib/abi";
import { DELULU_CONTRACT_ADDRESS } from "@/lib/constant";
import { hasChosenUsername, isInventedUsername } from "@/lib/profile/invented-username";

/** Pages that are not the product. Everywhere else, setProfile comes first. */
function profileExempt(pathname: string): boolean {
  return (
    pathname === "/welcome" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/signin") ||
    pathname.startsWith("/how-it-works/clip") ||
    pathname.startsWith("/dev") ||
    pathname.startsWith("/email") ||
    pathname === "/terms"
  );
}

/**
 * No signed-in wallet reaches any product page until setProfile has written
 * a username the person chose on the Delulu contract. A database row does
 * not count, and neither does the made-up player name that row may still hold.
 */
export function ProfileRequiredGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const router = useRouter();
  const { authenticated, address, isReady } = useAuth();
  const exempt = profileExempt(pathname);
  const check = isReady && authenticated && !!address && !exempt;

  const {
    data: onChainUsername,
    isLoading,
    isError,
    refetch,
  } = useReadContract({
    address: DELULU_CONTRACT_ADDRESS,
    abi: DELULU_ABI,
    functionName: "getUsername",
    args: address ? [address] : undefined,
    query: { enabled: check, staleTime: 0, gcTime: 0 },
  });
  const storedName = useStoredUsername(check ? address : undefined);
  const storedInvented = !!address && isInventedUsername(address, storedName);
  const hasProfile = !!address && hasChosenUsername(address, typeof onChainUsername === "string" ? onChainUsername : "");
  const chainSettled = !isLoading;
  const missing = check && chainSettled && !hasProfile && (!isError || storedInvented);

  useEffect(() => {
    if (missing) router.replace("/welcome");
  }, [missing, router]);

  if (!check || hasProfile) return <>{children}</>;
  if (isLoading || (isError && storedName === undefined)) return <AppLoader label="Set up your profile" />;
  if (isError && !storedInvented) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <h1 className="text-xl font-black text-foreground">Couldn&apos;t check your profile</h1>
        <p className="max-w-sm text-sm font-semibold text-muted-foreground">
          The network didn&apos;t answer, so the app stayed closed. Try the check again.
        </p>
        <button
          type="button"
          onClick={() => void refetch()}
          className="press-edge h-12 rounded-2xl bg-ink px-6 text-sm font-extrabold uppercase text-white"
        >
          Try again
        </button>
      </div>
    );
  }
  return <AppLoader label="Set up your profile" />;
}

"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { CreateFlowSkeleton } from "@/components/create-flow-skeleton";
import { MainDesktopHeader } from "@/components/main-desktop-header";
import { NavbarProfileMenu } from "@/components/navbar-profile-menu";
import { useAuth } from "@/hooks/use-auth";
import { useRequireGoodDollarWhitelist } from "@/hooks/use-require-gooddollar-whitelist";
import { preloadAuthProviders } from "@/lib/auth-session-hint";

const CreateDelusionContent = dynamic(
  () =>
    import("@/components/create-delusion-content").then((m) => m.CreateDelusionContent),
  { ssr: false, loading: () => <CreateFlowSkeleton /> }
);

export default function BoardPage() {
  const router = useRouter();
  const { authenticated, isReady } = useAuth();
  const { ensureWhitelisted } = useRequireGoodDollarWhitelist();

  useEffect(() => {
    if (!isReady) return;
    if (!authenticated) {
      preloadAuthProviders();
      router.replace("/sign-in?redirect=%2Fboard");
      return;
    }
    void ensureWhitelisted("create");
  }, [isReady, authenticated, router, ensureWhitelisted]);

  if (!isReady || !authenticated) {
    return (
      <main className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
        <CreateFlowSkeleton />
      </main>
    );
  }

  return (
    <main className="flex h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="lg:hidden sticky top-0 z-30 border-b border-border/40 bg-background/95 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3 px-6 py-3">
          <h1 className="text-lg font-black tracking-tight">Create</h1>
          <NavbarProfileMenu size="compact" />
        </div>
      </div>

      <MainDesktopHeader />

      <div className="hidden lg:block shrink-0 px-8 pt-6 pb-2">
        <h1 className="text-3xl font-black tracking-tight">Create</h1>
      </div>

      <div className="mx-auto flex w-full max-w-xl flex-1 min-h-0 flex-col lg:max-w-4xl">
        <CreateDelusionContent
          layout="main"
          onClose={() => router.push("/")}
        />
      </div>
    </main>
  );
}

import { AppLogo } from "@/components/app-logo";

/**
 * Full-screen app loading state. Matches AppSplashScreen exactly (same mark,
 * size and pulse) so the boot splash hands off to it without a visible change.
 */
export function AppLoader({ label = "Loading" }: { label?: string }) {
  return (
    <div role="status" className="flex min-h-screen w-full items-center justify-center bg-background">
      <AppLogo size={96} className="h-24 w-24 animate-logo-pulse" />
      <span className="sr-only">{label}</span>
    </div>
  );
}

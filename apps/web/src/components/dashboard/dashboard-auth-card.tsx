import Link from "next/link";
import { cn } from "@/lib/utils";

export function DashboardAuthCard({
  title,
  subtitle = "Dashboard",
  children,
  backHref = "/",
  className,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  backHref?: string;
  className?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f9f8f4] px-4 py-10">
      <div
        className={cn(
          "w-full max-w-2xl rounded-2xl border border-[#e8e8e3] bg-white p-8 shadow-sm sm:p-10",
          className,
        )}
      >
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
              {subtitle}
            </p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">{title}</h1>
          </div>
          <Link
            href={backHref}
            className="shrink-0 text-xs font-semibold text-muted-foreground hover:text-foreground"
          >
            ← Back
          </Link>
        </div>
        {children}
      </div>
    </main>
  );
}

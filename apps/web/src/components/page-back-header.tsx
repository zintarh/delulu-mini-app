"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/lib/utils";

/** Sticky sub-page header (redesign): round back button + title. */
export function PageBackHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  const router = useRouter();
  return (
    <div className={cn("sticky top-0 z-40 mx-auto max-w-xl bg-paper/95 px-5 py-3 backdrop-blur-sm", className)}>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="Back"
          className="press-edge inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white shadow-edge-sm"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.4} />
        </button>
        <div className="min-w-0">
          <h1 className="m-0 truncate text-2xl font-bold tracking-[-0.02em]">{title}</h1>
          {subtitle ? <p className="truncate text-sm text-muted-foreground">{subtitle}</p> : null}
        </div>
      </div>
    </div>
  );
}

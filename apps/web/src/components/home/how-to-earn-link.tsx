"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { Coin } from "@/components/ds";
import { cn } from "@/lib/utils";

/** Small, bright pointer from Home to /how-to-earn. */
export function HowToEarnLink({ className }: { className?: string }) {
  return (
    <Link
      href="/how-to-earn"
      className={cn(
        "press-edge group relative flex animate-rise items-center gap-3 overflow-hidden rounded-[20px] border-2 border-yellow-line bg-yellow px-3.5 py-2.5 text-ink no-underline shadow-edge-yellow-line",
        className,
      )}
    >
      <span className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <Coin size={30} className="animate-bounce-in transition-transform group-hover:rotate-12" />
      </span>
      <span className="min-w-0 flex-1 text-[15px] font-extrabold leading-tight">How to earn on Delulu</span>
      {/* A little coin pile for fun (no amounts here — they live on the page, from the live config). */}
      <span className="pointer-events-none relative h-7 w-12 shrink-0" aria-hidden>
        <Coin size={18} className="absolute bottom-0 left-0 -rotate-12" />
        <Coin size={22} className="absolute bottom-1 left-3 rotate-6" />
        <Coin size={16} className="absolute right-0 top-0 rotate-12" />
      </span>
      <ChevronRight className="h-4 w-4 shrink-0" strokeWidth={2.6} />
    </Link>
  );
}

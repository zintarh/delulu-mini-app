"use client";

import Link from "next/link";
import { Coin } from "@/components/ds";
import { cn } from "@/lib/utils";

/** Small, bright pill from Home to /how-to-earn — sits beside the greeting, takes no row of its own. */
export function HowToEarnLink({ className }: { className?: string }) {
  return (
    <Link
      href="/how-to-earn"
      className={cn(
        "press-edge group inline-flex shrink-0 animate-bounce-in items-center gap-1.5 rounded-full border-2 border-yellow-line bg-yellow py-1 pl-1.5 pr-3 text-[12px] font-extrabold text-ink no-underline shadow-edge-yellow-line",
        className,
      )}
    >
      <Coin size={18} className="transition-transform group-hover:rotate-12" />
      How to earn
    </Link>
  );
}

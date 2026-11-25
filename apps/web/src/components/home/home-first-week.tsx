"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import { buildSignInUrl } from "@/lib/auth-redirect";

/**
 * Top of Home for someone who has never earned a point. One button, and it
 * opens the four 100 G$ cards — not the old single First Week card.
 */
export function HomeFirstWeek({ guest = false, hidden = false }: { guest?: boolean; hidden?: boolean }) {
  const { address } = useAuth();
  const { points, isLoading } = useUserTotalPoints(guest ? undefined : address);
  if (hidden) return null;
  const href = guest ? buildSignInUrl("/play") : "/play";
  if (!guest && (!address || isLoading || points > 0)) return null;
  return (
    <Link
      href={href}
      className="press-edge flex items-center justify-between gap-3 rounded-[22px] border-2 border-ink bg-yellow px-4 py-3.5 text-ink no-underline shadow-[0_4px_0_#000]"
    >
      <span>
        <span className="block text-[15px] font-extrabold">Start my first week</span>
        <span className="mt-0.5 block text-[12px] font-semibold leading-snug text-[#5c4a0a]">Four cards, 100 G$ each. Claim today&apos;s G$ and join, or join with the G$ you already have.</span>
      </span>
      <ArrowRight className="h-5 w-5 shrink-0" />
    </Link>
  );
}

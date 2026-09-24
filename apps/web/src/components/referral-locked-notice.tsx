"use client";

import Link from "next/link";
import { Lock } from "lucide-react";
import type { ReferrerStanding } from "@/lib/referral/standing";

/**
 * Shown in place of the referral link while the referrer is behind on their
 * own campaign (lib/referral/standing.ts). Invites through a link they
 * already shared are on hold too, until today's proof is in.
 */
export function ReferralLockedNotice({ standing }: { standing: ReferrerStanding }) {
  const href = standing.campaign
    ? `/communities/${standing.campaign.slug}/campaigns/${standing.campaign.id}`
    : "/";

  return (
    <div className="mt-3 flex flex-col items-center gap-1.5">
      <Link
        href={href}
        className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-3.5 py-1.5 text-xs font-bold text-background shadow-sm transition-opacity active:opacity-70"
      >
        <Lock className="h-3.5 w-3.5" />
        Post today&apos;s proof to unlock invites
      </Link>
      <p className="max-w-[260px] text-[11px] leading-snug text-muted-foreground">
        You missed a milestone. Friends can&apos;t join with your link until you post.
      </p>
    </div>
  );
}

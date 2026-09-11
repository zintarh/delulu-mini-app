"use client";

import { useState } from "react";
import { Share2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useReferralCode } from "@/hooks/use-referral-code";

const REFERRAL_UNLOCK_THRESHOLD = 5;

export function ReferralBanner() {
  const { address } = useAuth();
  const { referralCode, referralCount } = useReferralCode(address);
  const [copied, setCopied] = useState(false);
  const unlocked = referralCount >= REFERRAL_UNLOCK_THRESHOLD;

  const handleCopy = async () => {
    if (!referralCode) return;
    const referralUrl = `${window.location.origin}/sign-in?ref=${referralCode}`;
    await navigator.clipboard.writeText(referralUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!referralCode) return null;

  return (
    <div className="group relative overflow-hidden rounded-2xl bg-[#D1E822] px-3.5 py-3 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm">
      <div className="flex flex-col sm:flex-row items-start sm:items-center sm:justify-between">
        <div className="relative flex items-start gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#244E1A]/10 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6">
            <Share2 className="h-4 w-4 text-[#244E1A]" strokeWidth={2} />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <p
                className="text-[8px] font-black uppercase tracking-[0.18em] text-[#244E1A]"
                style={{ fontFamily: "var(--font-manrope)" }}
              >
                Invite a friend
              </p>
              <span className="rounded-full bg-[#244E1A] px-1.5 py-0.5 text-[9px] font-black text-white">
                6,000 G$
              </span>
              <span className="rounded-full bg-[#244E1A]/10 px-1.5 py-0.5 text-[9px] font-black text-[#244E1A]">
                {Math.min(referralCount, REFERRAL_UNLOCK_THRESHOLD)}/{REFERRAL_UNLOCK_THRESHOLD}
              </span>
            </div>
            <p
              className="mt-0.5 font-black text-base sm:text-xl leading-[1.15] tracking-tight text-[#244E1A]"
              style={{ fontFamily: '"Clash Display", sans-serif' }}
            >
              Share your link, earn G$
            </p>
            <p className="mt-1 text-xs sm:text-sm leading-snug text-[#244E1A]/80">
              {unlocked
                ? "Unlocked — counts once they verify and join a campaign or start a Forfeit."
                : `Refer ${REFERRAL_UNLOCK_THRESHOLD} friends to unlock 6,000 G$ per referral.`}
            </p>
          </div>
        </div>

        <div className="hidden sm:flex justify-end">
          <button
            type="button"
            onClick={handleCopy}
            className="inline-flex items-center gap-1 rounded-full bg-[#244E1A] px-3 py-1.5 text-xs sm:text-sm font-black text-white transition-transform hover:scale-[1.04] active:scale-[0.97]"
          >
            {copied ? "Link copied!" : "Copy link →"}
          </button>
        </div>
      </div>

      <div className="sm:hidden flex justify-end mt-2">
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-full bg-[#244E1A] px-3 py-1.5 text-xs sm:text-sm font-black text-white transition-transform hover:scale-[1.04] active:scale-[0.97]"
        >
          {copied ? "Link copied!" : "Copy link →"}
        </button>
      </div>
    </div>
  );
}

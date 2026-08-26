"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Trophy, Coins, Sparkles, Compass, Gift, ShieldCheck, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useClaimAvailability } from "@/hooks/use-claim-availability";
import {
  FEED_CARD_CTA_CLASS,
  FEED_CARD_EYEBROW_CLASS,
  FEED_CARD_SUBTITLE_CLASS,
  FEED_CARD_TITLE_CLASS,
} from "@/components/feed-card-layout";

type FeatureCard = {
  id: string;
  eyebrow: string;
  headline: React.ReactNode;
  body: string;
  icon: React.ElementType;
  bgClassName: string;
  accentClassName: string;
  glow: string;
  action?: { label: string; href: string };
  /** White text on a dark card background instead of the default foreground/muted colors. */
  light?: boolean;
};

const AUTOPLAY_MS = 20000;

// Ordered deliberately: the action card leads (what to do next), then the
// tangible incentives for doing it, then the emotional "why" as a closer.
const CARDS: FeatureCard[] = [
  {
    id: "join-campaign",
    eyebrow: "Get started",
    headline: "Shape your future",
    body: "Join a campaign and start shaping your future.",
    icon: Compass,
    bgClassName: "bg-[#071593]",
    accentClassName: "bg-white/15 text-white",
    glow: "radial-gradient(ellipse 100% 80% at 100% 0%, rgba(255,255,255,0.12) 0%, transparent 60%)",
    action: { label: "Create forfeit today", href: "/forfeit" },
    light: true,
  },
  {
    id: "milestone-points",
    eyebrow: "Every milestone",
    headline: (
      <>
        1,000 <span className="text-[0.55em] font-black align-top">pts</span>
      </>
    ),
    body: "Complete a milestone, bank the points instantly.",
    icon: Trophy,
    bgClassName: "bg-[#E9C0E9]",
    accentClassName: "bg-black/10 text-[#1a1a19]",
    glow: "radial-gradient(ellipse 100% 80% at 0% 0%, rgba(255,255,255,0.25) 0%, transparent 60%)",
  },
  {
    id: "daily-claim-points",
    eyebrow: "Every daily claim",
    headline: (
      <>
        100 <span className="text-[0.55em] text-white/90  align-top">pts</span>
      </>
    ),
    body: "Claim your G$ each day, earn points on top.",
    icon: Coins,
    bgClassName: "bg-[#244F1A]",
    accentClassName: "bg-black/10 text-white/90",
    glow: "radial-gradient(ellipse 100% 80% at 100% 0%, rgba(255,255,255,0.25) 0%, transparent 60%)",
    light: true,
  },

  {
    id: "neuroscience",
    eyebrow: "Why it works",
    headline: "Small wins rewire the brain",
    body: "Every proof you submit strengthens the habit loop — that's neuroscience, not luck.",
    icon: Sparkles,
    bgClassName: "bg-[#70764E]",
    accentClassName: "bg-white/15 text-white",
    glow: "radial-gradient(ellipse 100% 80% at 50% 0%, rgba(255,255,255,0.12) 0%, transparent 60%)",
    light: true,
  },
];

/** Sits above the swipeable cards so it's visible no matter which card is
 * active or how far autoplay has advanced — claiming daily G$ shouldn't
 * depend on catching the right slide. Fixed dark-on-yellow rather than
 * theme tokens, same as the cards below: this background never changes
 * with the app theme, so its text can't either. */
function ClaimBar({
  availability,
  entitlementDisplay,
  onAction,
  busy,
}: {
  availability: "claimable" | "verify";
  entitlementDisplay: string | null;
  onAction: () => void;
  busy: boolean;
}) {
  const isVerify = availability === "verify";
  const Icon = isVerify ? ShieldCheck : Gift;
  const message = isVerify
    ? "Verify your identity to claim G$"
    : entitlementDisplay
      ? `${entitlementDisplay} G$ ready to claim`
      : "Your daily G$ is ready to claim";

  return (
    <button
      type="button"
      onClick={onAction}
      disabled={busy}
      className="mb-2.5 flex w-full items-center gap-2.5 rounded-2xl bg-delulu-yellow px-3.5 py-2.5 text-left transition-opacity hover:opacity-90 disabled:opacity-70"
    >
      <Icon className="h-4 w-4 shrink-0 text-[#1a1a19]" strokeWidth={2.25} />
      <span className="min-w-0 flex-1 truncate text-sm font-bold text-[#1a1a19]">
        {message}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#1a1a19] px-3 py-1 text-xs font-bold text-delulu-yellow">
        {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
        {isVerify ? "Verify" : "Claim"}
      </span>
    </button>
  );
}

export function HomeFeatureCarousel({
  showOnboardingCards = true,
}: {
  /** Onboarding cards only earn their space for someone with nothing at
   * stake yet — pass `!hasActiveStakes`. The claim bar ignores this and
   * shows on its own regardless, same reach `HomeClaimNudge` used to have. */
  showOnboardingCards?: boolean;
}) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);
  const { availability, entitlementDisplay, claimFromHome, isClaiming } = useClaimAvailability();

  const showClaimBar = availability === "claimable" || availability === "verify";

  const scrollToIndex = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    const slide = el.children[index] as HTMLElement | undefined;
    if (!slide) return;
    el.scrollTo({ left: slide.offsetLeft, behavior: "smooth" });
  };

  const handleScroll = () => {
    const el = scrollerRef.current;
    if (!el) return;
    const slides = Array.from(el.children) as HTMLElement[];
    if (slides.length === 0) return;
    const center = el.scrollLeft + el.clientWidth / 2;
    let best = 0;
    let bestDist = Infinity;
    slides.forEach((slide, i) => {
      const mid = slide.offsetLeft + slide.offsetWidth / 2;
      const dist = Math.abs(mid - center);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    });
    setActive(best);
  };

  // Auto-advance until the user takes control (touch/drag), then stop for good.
  useEffect(() => {
    if (!autoplay || !showOnboardingCards) return;
    const id = window.setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % CARDS.length;
        scrollToIndex(next);
        return next;
      });
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay, showOnboardingCards]);

  const stopAutoplay = () => setAutoplay(false);

  if (!showOnboardingCards && !showClaimBar) return null;

  return (
    <div>
      {availability === "claimable" || availability === "verify" ? (
        <ClaimBar
          availability={availability}
          entitlementDisplay={entitlementDisplay}
          onAction={claimFromHome}
          busy={isClaiming}
        />
      ) : null}

      {showOnboardingCards ? (
        <>
          <div
            ref={scrollerRef}
            onScroll={handleScroll}
            onPointerDown={stopAutoplay}
            className="scrollbar-hide -mx-4 flex snap-x snap-mandatory overflow-x-auto pb-1"
          >
            {CARDS.map((card) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.id}
                  className="w-full min-w-full shrink-0 snap-start px-4"
                >
                  <div
                    className={cn(
                      "group relative overflow-hidden rounded-3xl px-4 py-5 shadow-sm transition-all duration-300 hover:-translate-y-0.5 hover:shadow-sm",
                      card.bgClassName,
                    )}
                  >
                  <div
                    className="pointer-events-none absolute inset-0"
                    style={{ background: card.glow }}
                  />

                  <div className="relative flex h-full min-h-[140px] flex-col">
                    <div className="flex items-center justify-between">
                      <p
                        className={cn(
                          FEED_CARD_EYEBROW_CLASS,
                          card.light ? "text-white/70" : "text-[#1a1a19]/40",
                        )}
                      >
                        {card.eyebrow}
                      </p>
                      <div
                        className={cn(
                          "flex h-7 w-7 items-center justify-center rounded-lg transition-transform duration-300 group-hover:scale-110 group-hover:rotate-6",
                          card.accentClassName,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      </div>
                    </div>

                    <p
                      className={cn(
                        "mt-2.5",
                        FEED_CARD_TITLE_CLASS,
                        card.light ? "text-white" : "text-[#1a1a19]",
                      )}
                    >
                      {card.headline}
                    </p>

                    <p
                      className={cn(
                        "mt-1.5",
                        FEED_CARD_SUBTITLE_CLASS,
                        card.light ? "text-white/85" : "text-[#1a1a19]/70",
                      )}
                    >
                      {card.body}
                    </p>

                    {card.action ? (
                      <Link
                        href={card.action.href}
                        className={cn(
                          "mt-auto inline-flex w-fit items-center gap-1.5 self-start rounded-full px-3.5 py-1.5 transition-transform hover:scale-[1.04] active:scale-[0.97]",
                          FEED_CARD_CTA_CLASS,
                          card.light
                            ? "bg-white text-[#1a1a19]"
                            : "bg-delulu-blue text-white",
                        )}
                      >
                        {card.action.label} →
                      </Link>
                    ) : null}
                  </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-3 flex items-center justify-center gap-1.5">
            {CARDS.map((card, i) => (
              <button
                key={card.id}
                type="button"
                aria-label={`Go to card ${i + 1}`}
                onClick={() => {
                  stopAutoplay();
                  scrollToIndex(i);
                }}
                className={cn(
                  "h-1.5 rounded-full transition-all duration-300 hover:scale-125",
                  active === i ? "w-5 bg-delulu-blue" : "w-1.5 bg-border hover:bg-delulu-blue/50",
                )}
              />
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}

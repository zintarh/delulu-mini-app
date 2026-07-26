"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Trophy, Coins, Sparkles, Compass } from "lucide-react";
import { cn } from "@/lib/utils";
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
    action: { label: "Start now", href: "/explore" },
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
    accentClassName: "bg-black/10 text-foreground",
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

export function HomeFeatureCarousel() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [autoplay, setAutoplay] = useState(true);

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
    if (!autoplay) return;
    const id = window.setInterval(() => {
      setActive((prev) => {
        const next = (prev + 1) % CARDS.length;
        scrollToIndex(next);
        return next;
      });
    }, AUTOPLAY_MS);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoplay]);

  const stopAutoplay = () => setAutoplay(false);

  return (
    <div>
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
                      card.light ? "text-white/70" : "text-foreground/40",
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
                    card.light ? "text-white" : "text-foreground",
                  )}
                >
                  {card.headline}
                </p>

                <p
                  className={cn(
                    "mt-1.5",
                    FEED_CARD_SUBTITLE_CLASS,
                    card.light ? "text-white/85" : "text-muted-foreground",
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
                        ? "bg-white text-foreground"
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
    </div>
  );
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Camera } from "lucide-react";
import { CheckDot, Coin, Flame, GameButton, Lulu } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { hasStoredAuthSession } from "@/lib/auth-session-hint";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import { hasSeenIntro, markIntroDone, markIntroShowing } from "@/lib/app-intro";
import { cn } from "@/lib/utils";

/** Accounts set up longer ago than this already know the app — no intro. */
const NEW_ACCOUNT_MS = 3 * 24 * 3600 * 1000;

const CHIP = "rounded-full border-2 border-line bg-white px-3 py-1.5 text-sm font-bold shadow-edge";

function SayItArt() {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="animate-bob">
        <Lulu size={96} />
      </span>
      <div className="flex flex-wrap justify-center gap-2">
        <span className={CHIP}>Read</span>
        <span className={cn(CHIP, "border-ink bg-ink text-white")}>Workout</span>
        <span className={CHIP}>No sugar</span>
      </div>
    </div>
  );
}

function StakeItArt() {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="animate-bob">
        <Lulu size={96} mood="worried" />
      </span>
      <div className="flex items-center gap-2 rounded-2xl border-2 border-yellow-line bg-yellow-soft px-4 py-2 shadow-edge-yellow-line">
        <Coin size={26} />
        <span className="text-base font-extrabold">Your word or a little money</span>
      </div>
    </div>
  );
}

function ProveItArt() {
  return (
    <div className="flex flex-col items-center gap-4">
      <span className="animate-bob">
        <Lulu size={96} mood="kept" />
      </span>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-soft">
          <Camera className="h-6 w-6 text-blue" strokeWidth={2.2} />
        </span>
        <CheckDot size={34} />
        <span className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-extrabold shadow-edge">
          <Flame size={18} /> 7
        </span>
      </div>
    </div>
  );
}

const SLIDES: { title: string; body: string; art: ReactNode }[] = [
  { title: "Say it.", body: "Pick one small habit to do every day.", art: <SayItArt /> },
  {
    title: "Stake it.",
    body: "Put your word or a little money on it. Miss a day and it goes to a friend, a charity or the community pool.",
    art: <StakeItArt />,
  },
  {
    title: "Prove it.",
    body: "Snap a photo each day. Keep your streak, get your money back and earn rewards.",
    art: <ProveItArt />,
  },
];

/** Presentational intro — three slides, swipeable, Skip anytime. */
export function AppIntroView({
  guest,
  onDone,
  onStart,
  initialStep = 0,
}: {
  guest: boolean;
  /** For the dev preview. */
  initialStep?: number;
  /** Skip, finish, or "Look around first". */
  onDone: () => void;
  /** Guest's "Start now". */
  onStart?: () => void;
}) {
  const [i, setI] = useState(initialStep);
  const touchX = useRef<number | null>(null);
  const last = i === SLIDES.length - 1;
  const slide = SLIDES[i]!;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDone();
      if (e.key === "ArrowRight") setI((n) => Math.min(n + 1, SLIDES.length - 1));
      if (e.key === "ArrowLeft") setI((n) => Math.max(n - 1, 0));
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-[210] flex items-end justify-center bg-ink/50 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="app-intro-title"
        className="flex w-full max-w-[440px] animate-sheet-up flex-col rounded-t-[28px] bg-paper px-6 pb-[calc(20px+env(safe-area-inset-bottom,0px))] pt-4 sm:rounded-[28px]"
        onTouchStart={(e) => {
          touchX.current = e.touches[0]?.clientX ?? null;
        }}
        onTouchEnd={(e) => {
          const start = touchX.current;
          const end = e.changedTouches[0]?.clientX;
          touchX.current = null;
          if (start == null || end == null || Math.abs(end - start) < 40) return;
          setI((n) => (end < start ? Math.min(n + 1, SLIDES.length - 1) : Math.max(n - 1, 0)));
        }}
      >
        <div className="flex items-center justify-between">
          <span className="label-mono text-muted-foreground">Welcome to Delulu</span>
          {!last ? (
            <button type="button" onClick={onDone} className="p-2 text-sm font-semibold text-muted-foreground">
              Skip
            </button>
          ) : (
            <span className="h-9" aria-hidden />
          )}
        </div>

        <div key={i} className="flex min-h-[330px] animate-rise flex-col items-center justify-center gap-6 text-center">
          {slide.art}
          <div>
            <h2 id="app-intro-title" className="m-0 font-display text-[44px] font-extrabold uppercase leading-[0.9]">
              {slide.title}
            </h2>
            <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-snug text-muted-foreground">{slide.body}</p>
          </div>
        </div>

        <div className="mb-5 flex justify-center gap-2" aria-label={`Step ${i + 1} of ${SLIDES.length}`}>
          {SLIDES.map((_, n) => (
            <button
              key={n}
              type="button"
              aria-label={`Go to step ${n + 1}`}
              onClick={() => setI(n)}
              className={cn("h-2 rounded-full transition-all", n === i ? "w-6 bg-ink" : "w-2 bg-line")}
            />
          ))}
        </div>

        {/* Fixed height so the sheet doesn't jump when the last step adds a second button. */}
        <div className="flex min-h-[104px] flex-col gap-1">
          {!last ? (
            <GameButton full onClick={() => setI(i + 1)}>
              Next
            </GameButton>
          ) : guest ? (
            <>
              <GameButton full onClick={onStart}>
                Start now
              </GameButton>
              <button type="button" onClick={onDone} className="p-3 text-sm font-semibold text-muted-foreground">
                Look around first
              </button>
            </>
          ) : (
            <GameButton full onClick={onDone}>
              Let&apos;s go
            </GameButton>
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Shows the intro once per device on first open of the app: to guests, and to
 * accounts set up in the last few days. Existing users are marked done
 * silently, so an app update never greets them with a tour.
 */
export function AppIntro() {
  const { isReady, authenticated, address } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);
  const decided = useRef(false);
  const [restoreTimedOut, setRestoreTimedOut] = useState(false);

  useEffect(() => {
    const id = window.setTimeout(() => setRestoreTimedOut(true), 2_000);
    return () => window.clearTimeout(id);
  }, []);

  useEffect(() => {
    if (decided.current || !isReady) return;
    if (hasSeenIntro()) {
      decided.current = true;
      markIntroDone();
      return;
    }
    // A stored session may still be restoring — don't mistake a returning user for a guest.
    if (!authenticated && hasStoredAuthSession() && !restoreTimedOut) return;

    if (!authenticated || !address) {
      decided.current = true;
      markIntroShowing();
      setShow(true);
      return;
    }

    decided.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/onboarding?address=${address}`);
        const json = (await res.json()) as { onboardedAt?: string | null };
        const at = json.onboardedAt ? Date.parse(json.onboardedAt) : NaN;
        // No date = account from before onboarding was recorded: not new.
        if (Number.isFinite(at) && Date.now() - at < NEW_ACCOUNT_MS) {
          markIntroShowing();
          setShow(true);
          return;
        }
      } catch {
        // Unknown: don't risk touring an existing user.
      }
      markIntroDone();
    })();
  }, [isReady, authenticated, address, restoreTimedOut]);

  if (!show) return null;

  const done = () => {
    markIntroDone();
    setShow(false);
  };

  return (
    <AppIntroView
      guest={!authenticated}
      onDone={done}
      onStart={() => {
        done();
        persistSignInRedirect(pathname ?? "/home");
        router.push(buildSignInUrl(pathname ?? "/home"));
      }}
    />
  );
}

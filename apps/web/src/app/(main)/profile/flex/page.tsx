"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Download, Image as ImageIcon, Link2, MessageCircle } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { Flame, Lulu, Segmented, Stamp } from "@/components/ds";
import { ICON_BUTTON_CLASS } from "@/components/page-back-header";
import { useCreatorForfeits } from "@/hooks/use-creator-forfeits";
import { useAuth } from "@/hooks/use-auth";
import { useUserStreak } from "@/hooks/useUserStreak";
import { useUserTotalPoints } from "@/hooks/graph/useUserPoints";
import { useUserStore } from "@/stores/useUserStore";
import { getLevel, levelTitle } from "@/lib/levels";
import { cn } from "@/lib/utils";

const THEMES = {
  ink: { label: "Ink", bg: "#161615", fg: "#FFFFFF", accent: "#F6C324", sub: "#A3A39C" },
  yellow: { label: "Yellow", bg: "#F6C324", fg: "#161615", accent: "#161615", sub: "#4A3D0A" },
  paper: { label: "Paper", bg: "#F7F7F4", fg: "#161615", accent: "#B4410C", sub: "#5C5C56" },
} as const;
type ThemeId = keyof typeof THEMES;
type Kind = "streak" | "week";

/** Shareable streak card (design: docs/redesign/screens/FlexCard.dc.html). */
export default function FlexCardPage() {
  const { address } = useAuth();
  const user = useUserStore((s) => s.user);
  const { currentStreak, last7Days } = useUserStreak(address);
  const { points } = useUserTotalPoints(address);
  const { level } = getLevel(points ?? 0);
  const [theme, setTheme] = useState<ThemeId>("ink");
  const [kind, setKind] = useState<Kind>("streak");
  const [status, setStatus] = useState<string | null>(null);
  const t = THEMES[theme];
  const keptDays = last7Days.filter(Boolean).length;
  const username = user?.username ?? "";
  const { data: forfeits } = useCreatorForfeits(address);
  // Share of settled days kept across every contract ("94% kept").
  const keptPct = useMemo(() => {
    let kept = 0;
    let settled = 0;
    for (const f of forfeits ?? []) {
      for (const p of f.periods ?? []) {
        if (!p.resolvedAt && !p.proofUrl) continue;
        settled += 1;
        if (p.proofUrl && p.verifierAction !== "rejected" && p.verifierAction !== "timed_out") kept += 1;
      }
    }
    return settled > 0 ? Math.round((kept / settled) * 100) : null;
  }, [forfeits]);

  const imageUrl = useMemo(() => {
    const q = new URLSearchParams({
      user: username,
      streak: String(currentStreak),
      week: last7Days.map((d) => (d ? "1" : "0")).join(""),
      level: String(level),
      title: levelTitle(level),
      kept: keptPct == null ? "" : String(keptPct),
      kind,
      theme,
    });
    return `/api/og/flex?${q.toString()}`;
  }, [username, currentStreak, last7Days, level, keptPct, kind, theme]);

  const shareText =
    kind === "streak"
      ? `${currentStreak}-day streak on Delulu. Keeping my word.`
      : `${keptDays}/7 days kept this week on Delulu.`;

  const flash = (msg: string) => {
    setStatus(msg);
    window.setTimeout(() => setStatus(null), 2200);
  };

  const fetchImageFile = async () => {
    const res = await fetch(imageUrl);
    const blob = await res.blob();
    return new File([blob], "delulu-flex.png", { type: "image/png" });
  };

  const shareImage = async () => {
    try {
      const file = await fetchImageFile();
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text: shareText });
        return;
      }
      await saveImage();
    } catch {
      /* user cancelled */
    }
  };

  const saveImage = async () => {
    const file = await fetchImageFile();
    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.click();
    URL.revokeObjectURL(url);
    flash("Saved");
  };

  const shareChat = async () => {
    const url = window.location.origin;
    if (navigator.share) {
      try {
        await navigator.share({ text: shareText, url });
      } catch {
        /* cancelled */
      }
    } else {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${url}`)}`, "_blank", "noopener");
    }
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(`${shareText} ${window.location.origin}`);
    flash("Link copied");
  };

  const actions = [
    { label: "Save", icon: Download, onClick: () => void saveImage(), primary: true },
    { label: "Story", icon: ImageIcon, onClick: () => void shareImage() },
    { label: "Chat", icon: MessageCircle, onClick: () => void shareChat() },
    { label: "Link", icon: Link2, onClick: () => void copyLink() },
  ];

  return (
    <MainPage>
      <div className="mx-auto max-w-md px-5 pb-8 pt-4">
        <div className="flex items-center justify-between">
          <Link href="/profile" aria-label="Back" className={ICON_BUTTON_CLASS}>
            <ChevronLeft className="h-5 w-5" strokeWidth={2} />
          </Link>
          <span className="text-base font-bold">Flex card</span>
          <span className="w-11" />
        </div>

        <div className="mt-5 flex justify-center">
          <div
            className="flex h-[420px] w-[290px] animate-rise flex-col overflow-hidden rounded-[28px] p-[22px] shadow-[0_30px_50px_-30px_rgba(22,22,21,.6)] transition-colors"
            style={{ background: t.bg, color: t.fg }}
          >
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Lulu size={24} className={t.bg === "#161615" ? "lu-sticker-sm" : undefined} />
                <span className="font-brand text-xl font-bold">delulu</span>
              </span>
              <span className="label-mono text-[10px]" style={{ color: t.sub }}>
                {username ? `@${username}` : ""}
              </span>
            </div>

            {kind === "streak" ? (
              <>
                <div className="mt-[26px] flex items-end gap-1.5">
                  <span className="font-display text-[170px] font-extrabold uppercase leading-[0.78]" style={{ color: t.accent }}>
                    {currentStreak}
                  </span>
                  <span className="pb-2">
                    <Flame size={34} />
                  </span>
                </div>
                <div className="mt-2.5 font-display text-[30px] font-extrabold uppercase leading-[0.88]">Day streak</div>
              </>
            ) : (
              <>
                <div className="mt-[30px] font-display text-[120px] font-extrabold uppercase leading-[0.8]" style={{ color: t.accent }}>
                  {keptDays}/7
                </div>
                <div className="mt-2.5 font-display text-[30px] font-extrabold uppercase leading-[0.88]">Kept this week</div>
                <div className="mt-4 flex gap-1.5">
                  {last7Days.map((d, i) => (
                    <span
                      key={i}
                      className="aspect-square flex-1 rounded-full border-2"
                      style={{ borderColor: t.accent, background: d ? t.accent : "transparent" }}
                    />
                  ))}
                </div>
              </>
            )}

            <div className="mt-auto flex items-end justify-between">
              <div className="label-mono text-[10px] leading-[1.7]" style={{ color: t.sub }}>
                {keptPct != null ? (
                  <>
                    {keptPct}% kept
                    <br />
                  </>
                ) : null}
                Lvl {level} · {levelTitle(level)}
              </div>
              <span style={{ color: t.accent }}>
                <Stamp tone="ink" className="!bg-transparent !text-current text-[11px] !shadow-none">
                  Kept my word
                </Stamp>
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center gap-3">
          <Segmented<Kind>
            className="flex-1"
            ariaLabel="Card content"
            value={kind}
            onChange={setKind}
            options={[
              { value: "streak", label: "Streak" },
              { value: "week", label: "Week" },
            ]}
          />
          <div className="flex gap-2" role="group" aria-label="Card color">
            {(Object.keys(THEMES) as ThemeId[]).map((id) => (
              <button
                key={id}
                type="button"
                aria-label={`${THEMES[id].label} theme`}
                aria-pressed={theme === id}
                onClick={() => setTheme(id)}
                className="h-10 w-10 rounded-full"
                style={{
                  background: THEMES[id].bg,
                  boxShadow: theme === id ? "0 0 0 3px #F7F7F4, 0 0 0 5px #161615" : "inset 0 0 0 1.5px #D6D6CF",
                }}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2 text-center">
          {actions.map(({ label, icon: Icon, onClick, primary }) => (
            <button key={label} type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 text-xs font-medium">
              <span
                className={cn(
                  "press-edge flex h-[52px] w-[52px] items-center justify-center rounded-full border-2",
                  primary ? "border-ink bg-ink text-yellow shadow-[0_3px_0_#000]" : "border-line bg-white shadow-edge-sm",
                )}
              >
                <Icon className="h-5 w-5" strokeWidth={2.2} />
              </span>
              {label}
            </button>
          ))}
        </div>
        <p className="mt-3 h-5 text-center text-sm font-semibold text-green-edge" aria-live="polite">
          {status}
        </p>
      </div>
    </MainPage>
  );
}

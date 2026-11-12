"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CalendarDays, Settings2, Target, Users } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { Coin, Flame, Lulu, ProgressBar, gameButtonClass } from "@/components/ds";
import { AvatarStack } from "@/components/ui/avatar-stack";
import { facesToStack } from "@/components/support/support-delulu-card";
import { UserAvatar } from "@/components/ui/user-avatar";
import { goalIconFor, goalTintFor } from "@/components/goal-icon";
import { creatorName, durationLabel } from "@/components/support/support-delulu-card";
import { SupportModal } from "@/components/support/support-modal";
import { SupportersList } from "@/components/support/supporters-list";
import { useSupportDelulu } from "@/hooks/use-support";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { compactCount } from "@/lib/rewards/public-stats";
import { formatUsdFromG } from "@/lib/rewards/summary";
import { SUPPORT_CATEGORY_LABELS } from "@/lib/support/rules";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/support/format";

const TINT_BG: Record<string, string> = {
  yellow: "bg-yellow-soft text-[#8a6a00]",
  green: "bg-[#e6f3eb] text-[#157041]",
  pink: "bg-pink-soft text-pink",
};

const fmtDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : "—";

function Stat({ value, label, sub }: { value: React.ReactNode; label: string; sub?: string | null }) {
  return (
    <div className="min-w-0 flex-1 text-center">
      <div className="truncate font-display text-[24px] font-extrabold uppercase leading-none tabular-nums">{value}</div>
      <div className="label-mono mt-1.5 truncate text-[9px] text-muted-foreground">{label}</div>
      {sub ? <div className="mt-0.5 truncate text-[11px] font-semibold text-muted-foreground">{sub}</div> : null}
    </div>
  );
}

export default function PublicDeluluPage() {
  const { id } = useParams<{ id: string }>();
  const { data: d, isLoading } = useSupportDelulu(id);
  const { usd } = useGoodDollarPrice();
  const [open, setOpen] = useState(false);

  if (isLoading) {
    return (
      <MainPage className="bg-wash min-h-full">
        <PageBackHeader title="Delulu" />
        <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pt-4">
          <div className="h-[220px] animate-pulse rounded-[24px] bg-line/70" />
          <div className="h-[96px] animate-pulse rounded-[20px] bg-line/70" />
        </div>
      </MainPage>
    );
  }

  if (!d) {
    return (
      <MainPage className="bg-wash min-h-full">
        <PageBackHeader title="Delulu" />
        <div className="mx-auto flex max-w-md flex-col items-center px-5 py-16 text-center">
          <Lulu size={72} mood="worried" />
          <p className="m-0 mt-4 text-lg font-extrabold">This Delulu isn&apos;t public</p>
          <Link href="/support" className={gameButtonClass({ className: "mt-6 no-underline" })}>
            Find others to support
          </Link>
        </div>
      </MainPage>
    );
  }

  const Icon = goalIconFor(d.title);
  const pct = d.progress.total ? d.progress.kept / d.progress.total : 0;
  const usdLabel = formatUsdFromG(d.support.totalG, usd);
  const unit = d.cadence === "weekly" ? "week" : "day";

  return (
    <MainPage className="bg-wash min-h-full">
      <PageBackHeader
        title={d.title}
        eyebrow={d.category ? SUPPORT_CATEGORY_LABELS[d.category] : "Delulu"}
        right={
          d.isOwn ? (
            <Link href={`/forfeit/${d.id}`} className={gameButtonClass({ variant: "line", size: "sm", className: "no-underline" })}>
              <Settings2 className="h-4 w-4" /> Manage
            </Link>
          ) : undefined
        }
      />

      <div className="mx-auto flex max-w-xl flex-col gap-4 px-5 pb-12 pt-4">
        {/* Creator + story */}
        <section className="animate-rise rounded-[24px] border-2 border-line bg-white p-4 shadow-edge">
          <div className="flex items-center gap-3">
            <UserAvatar address="0x0000" username={d.creator.username} pfpUrl={d.creator.pfpUrl} size={44} />
            <div className="min-w-0 flex-1">
              <div className="truncate font-extrabold">{creatorName(d)}</div>
              <div className="label-mono mt-0.5 text-[9px] text-muted-foreground">Started {fmtDate(d.startsAt)}</div>
            </div>
            <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl", TINT_BG[goalTintFor(String(d.id))])}>
              <Icon className="h-5 w-5" strokeWidth={2.2} />
            </span>
          </div>
          {d.description ? <p className="m-0 mt-3 text-[15px] leading-relaxed">{d.description}</p> : null}
        </section>

        {/* Support stats */}
        <section className="flex animate-rise gap-2 rounded-[20px] border-2 border-yellow-line bg-yellow-soft px-3 py-4 shadow-edge-yellow-line">
          <Stat
            value={
              <span className="inline-flex items-center gap-1">
                <Coin size={20} />
                {compactCount(d.support.totalG)}
              </span>
            }
            label="G$ support"
            sub={usdLabel ? `≈ ${usdLabel}` : null}
          />
          <Stat
            value={
              <span className="inline-flex items-center gap-1">
                <Users className="h-5 w-5" strokeWidth={2.6} />
                {d.support.supporters}
              </span>
            }
            label={d.support.supporters === 1 ? "Supporter" : "Supporters"}
          />
          {d.progress.streak >= 2 ? (
            <Stat
              value={
                <span className="inline-flex items-center gap-1">
                  <Flame size={22} />
                  {d.progress.streak}
                </span>
              }
              label="Streak"
            />
          ) : null}
        </section>

        {/* Goal + progress */}
        <section className="animate-rise rounded-[20px] border-2 border-line bg-white p-4 shadow-edge">
          <div className="flex items-center gap-2 text-sm font-extrabold">
            <Target className="h-4 w-4" strokeWidth={2.6} />
            {d.cadence === "once" ? "One proof" : `Every ${unit} · ${durationLabel(d)}`}
          </div>
          <div className="mt-3">
            <div className="label-mono mb-1.5 flex justify-between text-[9px] text-muted-foreground">
              <span>{d.accepting ? `${unit} ${d.progress.currentDay} of ${d.progress.total}` : "Finished"}</span>
              <span className="tabular-nums">{d.progress.kept} kept</span>
            </div>
            <ProgressBar value={pct} />
          </div>
          <div className="mt-3 flex items-center gap-2 text-[13px] text-muted-foreground">
            <CalendarDays className="h-4 w-4 shrink-0" />
            {fmtDate(d.startsAt)} → {fmtDate(d.endsAt)}
          </div>
        </section>

        {!d.isOwn && d.accepting ? (
          <div className="flex items-center justify-center gap-2 text-[13px] font-bold">
            {d.support.faces.length > 0 ? (
              <>
                <AvatarStack participants={facesToStack(d.support.faces)} total={d.support.supporters} max={5} size={24} />
                <span>{d.support.supporters === 1 ? "is backing this" : "are backing this"}</span>
              </>
            ) : (
              <span className="rounded-full bg-pink-bright px-3 py-1 text-white shadow-[0_2px_0_#c23e6e]">Be the first to back this</span>
            )}
          </div>
        ) : null}
        {d.isOwn ? null : (
          <button
            type="button"
            disabled={!d.accepting}
            onClick={() => setOpen(true)}
            className={gameButtonClass({ full: true, size: "lg" })}
          >
            {d.accepting ? "Support with G$" : "Not accepting support"}
          </button>
        )}

        {/* Recent activity */}
        {d.recent.length > 0 ? (
          <section>
            <h2 className="m-0 mb-2.5 text-[18px] font-extrabold tracking-[-0.015em]">Recent support</h2>
            <div className="flex flex-col gap-2">
              {d.recent.map((r) => (
                <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 shadow-edge-sm">
                  <UserAvatar address="0x0000" username={r.supporter.username} pfpUrl={r.supporter.pfpUrl} size={30} />
                  <span className="min-w-0 flex-1 truncate text-sm">
                    <b>{r.supporter.username ? `@${r.supporter.username}` : "Someone"}</b> sent{" "}
                    <b className="tabular-nums">{r.amountG.toLocaleString("en-US")} G$</b>
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{timeAgo(r.at)}</span>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <SupportersList onChainId={d.id} count={d.support.supporters} />
      </div>

      <SupportModal delulu={d} open={open} onOpenChange={setOpen} />
    </MainPage>
  );
}

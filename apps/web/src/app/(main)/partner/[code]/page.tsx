"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { Check, CheckCircle2, Copy, Loader2, Search, ShieldCheck, Ticket, UserRound, X } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { GameCard, Lulu, gameButtonClass } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import type { PartnerFriend, PartnerReport } from "@/lib/referral/partners";
import { cn } from "@/lib/utils";

type Filter = "all" | "completed" | "in_progress" | "not_verified" | "not_joined" | "profile" | "back3" | "back7";

const FILTERS: { key: Filter; label: string; test: (f: PartnerFriend) => boolean }[] = [
  { key: "all", label: "All", test: () => true },
  { key: "completed", label: "Completed", test: (f) => f.completed },
  { key: "in_progress", label: "In progress", test: (f) => !f.completed },
  { key: "not_verified", label: "Not verified", test: (f) => !f.verified },
  { key: "not_joined", label: "Not joined", test: (f) => !f.joined },
  { key: "profile", label: "Profile not done", test: (f) => !f.profileComplete },
  { key: "back3", label: "Back 3+ days", test: (f) => f.daysBack >= 3 },
  { key: "back7", label: "Back 7+ days", test: (f) => f.daysBack >= 7 },
];

const fmt = (n: number) => n.toLocaleString("en-US");
const short = (w: string) => `${w.slice(0, 6)}…${w.slice(-4)}`;
const date = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Africa/Lagos" });

export default function PartnerPage() {
  const { code: raw } = useParams<{ code: string }>();
  const code = String(raw ?? "").toUpperCase();
  const { address, authenticated } = useAuth();
  const [data, setData] = useState<(PartnerReport & { viewer: string }) | null>(null);
  const [err, setErr] = useState<{ status: number; message: string } | null>(null);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setErr(null);
    fetch(`/api/partner/${code}`, { credentials: "include" })
      .then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }))
      .then(({ ok, status, j }) => {
        if (cancelled) return;
        if (ok) setData(j);
        else setErr({ status, message: j.error ?? "Couldn't load this page." });
      })
      .catch(() => !cancelled && setErr({ status: 0, message: "You seem to be offline." }));
    return () => { cancelled = true; };
  }, [code, address, authenticated]);

  const list = useMemo(() => {
    if (!data) return [];
    const test = FILTERS.find((f) => f.key === filter)!.test;
    const s = q.trim().toLowerCase().replace(/^@/, "");
    return data.friends.filter((f) => test(f) && (!s || f.wallet.includes(s) || (f.username ?? "").toLowerCase().includes(s)));
  }, [data, filter, q]);

  if (err) {
    return (
      <MainPage>
        <PageBackHeader title="Your referrals" />
        <div className="mx-auto flex max-w-md flex-col items-center gap-4 px-5 py-12 text-center">
          <Lulu size={96} />
          <p className="m-0 text-[15px] font-bold">{err.message}</p>
          {err.status === 401 ? (
            <a
              href={buildSignInUrl(`/partner/${code}`)}
              onClick={() => persistSignInRedirect(`/partner/${code}`)}
              className={gameButtonClass({ variant: "yellow", full: true })}
            >
              Sign in
            </a>
          ) : null}
        </div>
      </MainPage>
    );
  }

  if (!data) {
    return (
      <MainPage>
        <PageBackHeader title="Your referrals" />
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      </MainPage>
    );
  }

  const t = data.totals;
  const pct = (n: number) => (t.brought ? Math.round((n / t.brought) * 100) : 0);

  return (
    <MainPage>
      <PageBackHeader title={`${data.partner.name}'s referrals`} subtitle={`${fmt(t.brought)} joined · ${fmt(t.completed)} completed`} />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-10 pt-2">
        <GameCard tone="yellow" className="p-4">
          <p className="label-mono m-0 text-[10px] text-[#8a6a00]">Your link</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-display text-[22px] font-extrabold uppercase">{data.partner.link.replace(/^https?:\/\/(www\.)?/, "")}</span>
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(data.partner.link).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); })}
              className={gameButtonClass({ variant: "ink", size: "sm" })}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="m-0 mt-2 text-[12px] font-semibold text-[#5f4a00]">
            Completed = signed up, face-verified, joined a campaign and earned {fmt(data.partner.minPoints)} points.
          </p>
        </GameCard>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Brought" value={t.brought} />
          <Stat label="Completed" value={t.completed} sub={`${pct(t.completed)}%`} strong />
          <Stat label="Back 3+ days" value={t.back3} sub={`${pct(t.back3)}%`} />
          <Stat label="Back 7+ days" value={t.back7} sub={`${pct(t.back7)}%`} />
        </div>

        <GameCard className="p-4">
          <p className="label-mono m-0 text-[10px] text-muted-foreground">How far they got</p>
          <div className="mt-3 flex flex-col gap-2.5">
            <Step icon={UserRound} label="Signed up" n={t.brought} of={t.brought} />
            <Step icon={UserRound} label="Finished their profile" n={t.brought - t.profileIncomplete} of={t.brought} />
            <Step icon={ShieldCheck} label="Face-verified" n={t.verified} of={t.brought} />
            <Step icon={Ticket} label="Joined a campaign" n={t.joined} of={t.brought} />
            <Step icon={CheckCircle2} label={`Completed (${fmt(data.partner.minPoints)} pts)`} n={t.completed} of={t.brought} />
          </div>
        </GameCard>

        <div className="relative">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <label htmlFor="partner-search" className="sr-only">Search by username or wallet</label>
          <input
            id="partner-search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search username or wallet"
            className="h-12 w-full rounded-2xl border-2 border-line bg-white pl-10 pr-10 text-[14px] font-semibold outline-none focus:border-ink"
          />
          {q ? (
            <button type="button" aria-label="Clear search" onClick={() => setQ("")} className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1" role="group" aria-label="Filter">
          {FILTERS.map((f) => {
            const n = data.friends.filter(f.test).length;
            return (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={cn(
                  "shrink-0 rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold",
                  filter === f.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
                )}
              >
                {f.label} · {n}
              </button>
            );
          })}
        </div>

        {list.length === 0 ? (
          <p className="py-8 text-center text-[13px] font-semibold text-muted-foreground">
            {t.brought === 0 ? "No one has joined through your link yet. Share it!" : "No one matches."}
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {list.map((f) => (
              <li key={f.wallet}>
                <GameCard className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[15px] font-extrabold">{f.username ? `@${f.username}` : "No username yet"}</p>
                      <p className="m-0 mt-0.5 font-mono text-[11px] text-muted-foreground">{short(f.wallet)} · joined {date(f.signedUpAt)}</p>
                    </div>
                    {f.completed ? (
                      <span className="shrink-0 rounded-full bg-green px-2.5 py-1 text-[11px] font-extrabold text-ink">Completed</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-yellow-soft px-2.5 py-1 text-[11px] font-extrabold text-[#8a6a00]">In progress</span>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge ok={f.profileComplete} label="Profile" />
                    <Badge ok={f.verified} label="Verified" />
                    <Badge ok={f.joined} label="Joined" />
                    <Badge ok={f.points >= data.partner.minPoints} label={`${fmt(f.points)} / ${fmt(data.partner.minPoints)} pts`} />
                    <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">
                      Back {f.daysBack} {f.daysBack === 1 ? "day" : "days"}
                    </span>
                  </div>
                </GameCard>
              </li>
            ))}
          </ul>
        )}
        <p className="m-0 text-center text-[11px] text-muted-foreground">
          &ldquo;Back&rdquo; counts the days after sign-up they opened the app or kept a goal. Updated every few minutes.
        </p>
      </div>
    </MainPage>
  );
}

function Stat({ label, value, sub, strong }: { label: string; value: number; sub?: string; strong?: boolean }) {
  return (
    <GameCard tone={strong ? "green" : "default"} className="px-3 py-2.5">
      <p className="label-mono m-0 text-[10px] text-muted-foreground">{label}</p>
      <p className="m-0 mt-0.5 font-display text-[28px] font-extrabold leading-none tabular-nums">{fmt(value)}</p>
      {sub ? <p className="m-0 mt-1 text-[11px] font-bold text-muted-foreground">{sub}</p> : null}
    </GameCard>
  );
}

function Step({ icon: Icon, label, n, of }: { icon: typeof UserRound; label: string; n: number; of: number }) {
  const w = of ? Math.round((n / of) * 100) : 0;
  return (
    <div>
      <div className="flex items-center justify-between gap-2 text-[13px] font-bold">
        <span className="flex items-center gap-2"><Icon className="h-4 w-4 text-muted-foreground" /> {label}</span>
        <span className="tabular-nums">{fmt(n)}</span>
      </div>
      <span className="mt-1 block h-2 overflow-hidden rounded-full bg-line">
        <span className="block h-full rounded-full bg-ink" style={{ width: `${w}%` }} />
      </span>
    </div>
  );
}

function Badge({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold", ok ? "bg-green-soft text-green-edge" : "bg-orange-soft text-orange")}>
      {ok ? <Check className="h-3 w-3" strokeWidth={3} /> : <X className="h-3 w-3" strokeWidth={3} />} {label}
    </span>
  );
}

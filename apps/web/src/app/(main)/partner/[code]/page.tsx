"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { Check, CheckCircle2, Coins, Copy, Loader2, Search, Ticket, UserRound, Wallet, X } from "lucide-react";
import { MainPage } from "@/components/main-app-header";
import { PageBackHeader } from "@/components/page-back-header";
import { GameCard, Lulu, gameButtonClass } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { buildSignInUrl, persistSignInRedirect } from "@/lib/auth-redirect";
import type { PartnerFriend, PartnerListFilter, PartnerMissing, PartnerReport } from "@/lib/referral/partners";
import { cn } from "@/lib/utils";

const MISSING_LABEL: Record<PartnerMissing, string> = {
  verify: "Face check left",
  claim: "Hasn't claimed G$",
  stake: "Hasn't staked G$",
  join: "Hasn't joined a Bingo card",
  points: "Short on points",
};

const FILTERS: { key: PartnerListFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "claim", label: "Didn't claim" },
  { key: "stake", label: "Didn't stake" },
  { key: "join", label: "Didn't join a card" },
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
  const [listError, setListError] = useState("");
  const [loadingList, setLoadingList] = useState(false);
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [filter, setFilter] = useState<PartnerListFilter>("all");
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");

  const lastQuery = useRef(q.trim());
  const hasData = useRef(false);
  useEffect(() => {
    const t = setTimeout(() => {
      const next = q.trim();
      if (lastQuery.current !== next) {
        lastQuery.current = next;
        setPage(1);
      }
      setDebouncedQ(next);
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let cancelled = false;
    setListError("");
    setLoadingList(true);
    const params = new URLSearchParams({ page: String(page), filter });
    if (debouncedQ) params.set("q", debouncedQ);
    fetch(`/api/partner/${code}?${params}`, { credentials: "include" })
      .then(async (r) => ({ ok: r.ok, status: r.status, j: await r.json().catch(() => ({})) }))
      .then(({ ok, status, j }) => {
        if (cancelled) return;
        if (ok) {
          hasData.current = true;
          setData(j);
          setErr(null);
          setListError("");
        } else {
          const message = j.error ?? "Couldn't load this page. Try again in a moment.";
          if (hasData.current) setListError(message);
          else setErr({ status, message });
        }
      })
      .catch(() => {
        if (cancelled) return;
        if (hasData.current) setListError("You seem to be offline.");
        else setErr({ status: 0, message: "You seem to be offline." });
      })
      .finally(() => { if (!cancelled) setLoadingList(false); });
    return () => { cancelled = true; };
  }, [code, address, authenticated, page, filter, debouncedQ]);

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
        <div className="flex flex-col items-center gap-3 py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="m-0 text-[13px] text-muted-foreground">Loading your referrals</p>
        </div>
      </MainPage>
    );
  }

  const t = data.totals;
  const pct = (n: number) => (t.brought ? Math.round((n / t.brought) * 100) : 0);

  return (
    <MainPage>
      <PageBackHeader title={`${data.partner.name}'s referrals`} />
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-10 pt-2">
        <GameCard tone="yellow" className="p-4">
          <p className="label-mono m-0 text-[10px] text-[#8a6a00]">Your link</p>
          <div className="mt-1.5 flex items-center gap-2">
            <span className="min-w-0 flex-1 truncate font-display text-[22px] font-extrabold uppercase">{data.partner.link.replace(/^https?:\/\/(www\.)?/, "")}</span>
            <button
              type="button"
              onClick={() => {
                setCopyError("");
                void navigator.clipboard.writeText(data.partner.link).then(
                  () => { setCopied(true); setTimeout(() => setCopied(false), 1500); },
                  () => setCopyError("Couldn't copy the link. Select it and copy it yourself."),
                );
              }}
              className={gameButtonClass({ variant: "ink", size: "sm" })}
            >
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied ? "Copied" : "Copy"}
            </button>
          </div>
          {copyError ? <p className="m-0 mt-2 text-[12px] font-bold text-orange">{copyError}</p> : null}
          <p className="m-0 mt-3 text-[13px] font-extrabold text-[#5f4a00]">A friend counts only after all of this</p>
          <ol className="m-0 mt-1.5 list-decimal space-y-1 pl-4 text-[12px] font-semibold text-[#5f4a00]">
            <li>They open your link and sign up.</li>
            <li>They pass the GoodDollar face check.</li>
            <li>They claim their free G$.</li>
            <li>They stake that G$ on a Bingo card. Staking is what GoodDollar counts as actually using the contracts.</li>
            <li>They earn {fmt(data.partner.minPoints)} points. That is one kept photo on a 100 G$ card.</li>
          </ol>
          <p className="m-0 mt-2 text-[12px] font-semibold text-[#5f4a00]">
            The newest people are listed 10 at a time. Each one shows the step they still need, including the face check and points.
          </p>
        </GameCard>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Brought" value={t.brought} />
          <Stat label="Claimed G$" value={t.claimed} sub={`${pct(t.claimed)}%`} />
          <Stat label="Staked G$" value={t.staked} sub={`${pct(t.staked)}%`} strong />
          <Stat label="Back 3+ days" value={t.back3} sub={`${pct(t.back3)}%`} />
        </div>

        <GameCard className="p-4">
          <p className="label-mono m-0 text-[10px] text-muted-foreground">How far they got</p>
          <div className="mt-3 flex flex-col gap-2.5">
            <Step icon={UserRound} label="Signed up" n={t.brought} of={t.brought} />
            <Step icon={Coins} label="Claimed free G$" n={t.claimed} of={t.brought} />
            <Step icon={Wallet} label="Staked that G$" n={t.staked} of={t.brought} />
            <Step icon={Ticket} label="Joined a Bingo card" n={t.joined} of={t.brought} />
            <Step icon={CheckCircle2} label="Back 7+ days" n={t.back7} of={t.brought} />
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
          {FILTERS.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => { setFilter(f.key); setPage(1); }}
                className={cn(
                  "shrink-0 rounded-full border-2 px-3 py-1.5 text-[12px] font-extrabold",
                  filter === f.key ? "border-ink bg-ink text-white" : "border-line bg-white text-ink",
                )}
              >
                {f.label} · {fmt(data.filterCounts[f.key])}
              </button>
            ))}
        </div>

        {listError ? <p className="m-0 text-center text-[13px] font-bold text-orange">{listError}</p> : null}
        {loadingList && data.friends.length === 0 ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : data.friends.length === 0 ? (
          <p className="py-8 text-center text-[13px] font-semibold text-muted-foreground">
            {t.brought === 0 ? "No one has joined through your link yet. Share it!" : "No one matches."}
          </p>
        ) : (
          <ul className={cn("flex flex-col gap-2", loadingList && "opacity-60")}>
            {data.friends.map((f) => (
              <li key={f.wallet}>
                <GameCard className="p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="m-0 truncate text-[15px] font-extrabold">{f.username ? `@${f.username}` : "No username yet"}</p>
                      <p className="m-0 mt-0.5 font-mono text-[11px] text-muted-foreground">{short(f.wallet)} · joined {date(f.signedUpAt)}</p>
                    </div>
                    {f.completed ? (
                      <span className="shrink-0 rounded-full bg-green px-2.5 py-1 text-[11px] font-extrabold text-ink">Counted</span>
                    ) : (
                      <span className="shrink-0 rounded-full bg-yellow-soft px-2.5 py-1 text-[11px] font-extrabold text-[#8a6a00]">
                        {f.missing ? MISSING_LABEL[f.missing] : "Fell off"}
                      </span>
                    )}
                  </div>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <Badge ok={f.verified} label="Face check" />
                    <Badge ok={f.claimed} label="Claimed" />
                    <Badge ok={f.staked} label="Staked" />
                    <Badge ok={f.joined} label="Bingo card" />
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
        {data.totalFriends > 0 ? (
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              disabled={data.page <= 1 || loadingList}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="rounded-full border-2 border-line bg-white px-3 py-1.5 text-[12px] font-extrabold disabled:opacity-40"
            >
              Previous
            </button>
            <p className="m-0 text-[12px] font-bold text-muted-foreground">
              {fmt((data.page - 1) * data.pageSize + 1)}–{fmt((data.page - 1) * data.pageSize + data.friends.length)} of {fmt(data.totalFriends)}
            </p>
            <button
              type="button"
              disabled={data.page * data.pageSize >= data.totalFriends || loadingList}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-full border-2 border-line bg-white px-3 py-1.5 text-[12px] font-extrabold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        ) : null}
        <p className="m-0 text-center text-[11px] text-muted-foreground">
          &ldquo;Back&rdquo; on the totals counts days they opened the app after sign-up. On each person it also counts a day they kept a goal.
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

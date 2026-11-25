"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Globe, Landmark, Loader2, Plus, Search } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { GameButton } from "@/components/ds";
import { useAuth } from "@/hooks/use-auth";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { forgetAccount, loadSavedAccounts, rememberAccount, useCashOut, type CashOutPhase, type CashOutSetup, type SavedAccount } from "@/hooks/use-cash-out";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { formatNaira, MAX_WITHDRAW_G, type Bank, type CashOutView, type Quote } from "@/lib/cashout/goodcash";
import { cn } from "@/lib/utils";

type Step = "amount" | "bank" | "banks" | "review";

const INPUT =
  "h-12 w-full rounded-2xl border-2 border-line bg-white px-4 text-[15px] font-semibold text-ink placeholder:text-muted-foreground/60 outline-none transition-colors focus:border-ink disabled:opacity-60";
const CHIP =
  "h-8 rounded-full border-2 border-line bg-white px-3.5 text-[12px] font-extrabold uppercase tracking-[0.04em] text-ink transition-transform active:scale-95";

const fmtG = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const groupDigits = (v: string) => {
  const [w, f] = v.split(".");
  return (w ?? "").replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f !== undefined ? `.${f}` : "");
};
const cleanAmount = (v: string) =>
  v.replace(/[^\d.]/g, "").replace(/(\..*)\./g, "$1").replace(/^(\d*\.\d{0,2}).*$/, "$1");

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** False outside Nigeria: cash out only pays Nigerian bank accounts. */
  inNigeria: boolean;
  /** Offer Send instead when cash out isn't available here. */
  onSend?: () => void;
  onCashedOut?: () => void;
}

/**
 * Cash out: G$ from the wallet to the player's own Nigerian bank account.
 * Amount → bank → review → live progress. Every fee and the bank's own name
 * for the account are shown before they confirm; once money has moved there
 * is no "try again", only progress.
 */
export function CashOutSheet({ open, onOpenChange, inNigeria, onSend, onCashedOut }: Props) {
  const { address } = useAuth();
  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Cash out"
      hideTitleVisually
      sheetClassName="border-t border-border/20 !h-auto !max-h-[90vh] overflow-y-auto !p-0 !z-[70] rounded-t-3xl"
      modalClassName="max-w-md"
    >
      {open && address ? (
        <CashOutFlow address={address} inNigeria={inNigeria} onSend={onSend} onClose={() => onOpenChange(false)} onCashedOut={onCashedOut} />
      ) : null}
    </ResponsiveSheet>
  );
}

function CashOutFlow({
  address, inNigeria, onSend, onClose, onCashedOut,
}: { address: `0x${string}`; inNigeria: boolean; onSend?: () => void; onClose: () => void; onCashedOut?: () => void }) {
  const flow = useCashOut();
  const { phase } = flow;
  const gDollar = useTokenBalance(GOODDOLLAR_ADDRESSES.mainnet);
  const balanceG = Math.floor(parseFloat(gDollar.formatted) || 0);

  const [setup, setSetup] = useState<CashOutSetup | null>(null);
  const [step, setStep] = useState<Step>("amount");
  const [amount, setAmount] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [quoteErr, setQuoteErr] = useState("");
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    if (!inNigeria) return;
    void flow.resume();
    fetch("/api/cashout/setup")
      .then((r) => r.json())
      .then((d: CashOutSetup) => setSetup(d))
      .catch(() => setSetup({ enabled: true, error: "You seem to be offline. Check your connection and try again." }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, inNigeria]);

  // Refresh balances once the bank is paid (or the money came back).
  const finalStatus = phase.kind === "tracking" ? phase.cashOut.status : null;
  useEffect(() => {
    if (finalStatus === "paid" || finalStatus === "refunded" || finalStatus === "failed") {
      void gDollar.refetch();
      onCashedOut?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finalStatus]);

  // Live quote as they type, fresh every 25 s while they look at it.
  const amountNum = Number(amount);
  const quoteTick = useQuoteTick(step === "review" || step === "amount");
  useEffect(() => {
    setQuoteErr("");
    if (!amount || !(amountNum > 0) || !setup?.enabled) { setQuote(null); return; }
    let cancelled = false;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/cashout/quote?amountG=${encodeURIComponent(amount)}`);
        const d = await r.json();
        if (cancelled) return;
        if (r.ok) setQuote(d as Quote);
        else { setQuote(null); setQuoteErr(d.error ?? "Couldn't get a price. Try again."); }
      } catch { if (!cancelled) setQuoteErr("You seem to be offline."); }
      finally { if (!cancelled) setQuoting(false); }
    }, 350);
    return () => { cancelled = true; clearTimeout(t); };
  }, [amount, amountNum, setup?.enabled, quoteTick]);

  // ── Bank account ──────────────────────────────────────────────────────────
  const [saved, setSaved] = useState<SavedAccount[]>(() => loadSavedAccounts(address));
  const [picked, setPicked] = useState<number | null>(() => (loadSavedAccounts(address).length ? 0 : null));
  const [bank, setBank] = useState<Bank | null>(null);
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [verifyErr, setVerifyErr] = useState("");
  useEffect(() => {
    setAccountName(""); setVerifyErr("");
    if (!bank || accountNumber.length !== 10) return;
    let cancelled = false;
    setVerifying(true);
    fetch("/api/cashout/verify", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ bankCode: bank.code, accountNumber }),
    })
      .then(async (r) => ({ ok: r.ok, d: await r.json().catch(() => ({})) }))
      .then(({ ok, d }) => {
        if (cancelled) return;
        if (ok && d.accountName) setAccountName(d.accountName);
        else setVerifyErr(d.error ?? "We couldn't check that account. Try again.");
      })
      .catch(() => { if (!cancelled) setVerifyErr("You seem to be offline."); })
      .finally(() => { if (!cancelled) setVerifying(false); });
    return () => { cancelled = true; };
  }, [bank, accountNumber]);

  const account: SavedAccount | null = picked !== null && saved[picked]
    ? saved[picked]
    : bank && accountName ? { bankCode: bank.code, bankName: bank.name, accountNumber, accountName } : null;

  // ── What stops them continuing ────────────────────────────────────────────
  const maxG = setup?.maximumG ?? MAX_WITHDRAW_G;
  const amountProblem = (() => {
    if (!amount || !(amountNum > 0)) return "";
    if (amountNum > balanceG) return "That's more G$ than you have.";
    if (amountNum > maxG) return `The most at once is ${fmtG(maxG)} G$.`;
    const min = quote?.minimumG ?? setup?.minimumG;
    if (min && amountNum < min) return `The smallest cash out is ${fmtG(Math.ceil(min))} G$.`;
    return "";
  })();
  const amountReady = !!quote && !quoting && !amountProblem && !quoteErr && quote.enough !== false && quote.amountG === amount;

  const confirm = () => {
    if (!quote || !account || !setup?.mode) return;
    void flow.start({ amountG: amount, quote, account, mode: setup.mode });
  };

  const following = phase.kind === "tracking" || phase.kind === "sending" || phase.kind === "checking";
  const busy = phase.kind === "creating" || phase.kind === "signing" || phase.kind === "sending" || phase.kind === "checking";
  const title = step === "banks" && !following ? "Choose your bank" : "Cash out";
  const canGoBack = !following && !busy && step !== "amount";
  const back = () => setStep(step === "banks" ? "bank" : step === "review" ? "bank" : "amount");
  const ready = inNigeria && !!setup?.enabled && !setup.error;

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5 px-5 pb-8 pt-4 lg:px-1 lg:pt-1">
      <div className="flex items-center gap-2">
        {canGoBack ? (
          <button type="button" onClick={back} aria-label="Back" className="-ml-1 rounded-full p-1.5 text-ink hover:bg-muted">
            <ChevronLeft className="h-5 w-5" />
          </button>
        ) : null}
        <h2 className="font-display text-[22px] font-extrabold uppercase leading-none">{title}</h2>
        {setup?.mode === "test" ? (
          <span className="rounded-full bg-yellow px-2.5 py-1 text-[10px] font-extrabold uppercase text-ink">Test</span>
        ) : null}
        {ready && !following && step !== "banks" ? (
          <div className="ml-auto mr-8 flex items-center gap-1.5 lg:mr-6" aria-label={`Step ${step === "amount" ? 1 : step === "review" ? 3 : 2} of 3`}>
            {(["amount", "bank", "review"] as const).map((s, i) => {
              const idx = step === "amount" ? 0 : step === "review" ? 2 : 1;
              return <span key={s} className={cn("h-1.5 rounded-full transition-all", i === idx ? "w-5 bg-ink" : i < idx ? "w-1.5 bg-ink/40" : "w-1.5 bg-line")} />;
            })}
          </div>
        ) : null}
      </div>

      {following ? (
        <Progress
          phase={phase}
          naira={phase.kind === "tracking" ? phase.cashOut.naira : (quote?.receive.naira ?? 0)}
          accountName={phase.kind === "tracking" ? (phase.cashOut.accountName ?? account?.accountName) : account?.accountName}
          bankLine={phase.kind === "tracking" && phase.cashOut.bankName
            ? `${phase.cashOut.bankName} ••${phase.cashOut.accountLast4}`
            : account ? `${account.bankName} ••${account.accountNumber.slice(-4)}` : ""}
          onDone={onClose}
          onAgain={() => { flow.reset(); setAmount(""); setQuote(null); setStep("amount"); }}
        />
      ) : !inNigeria ? (
        <Notice icon={<Globe className="h-6 w-6" />} title="Nigeria only, for now" body="Cash out pays Nigerian bank accounts. You can still send your G$ to any wallet.">
          {onSend ? <GameButton variant="ink" full onClick={onSend}>Send instead</GameButton> : null}
        </Notice>
      ) : !setup ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <div className="h-[120px] animate-pulse rounded-3xl bg-muted" />
          <div className="h-12 animate-pulse rounded-2xl bg-muted" />
        </div>
      ) : !setup.enabled ? (
        <Notice icon={<Landmark className="h-6 w-6" />} title="Coming soon" body="You'll be able to send money straight to your bank from here." />
      ) : setup.error ? (
        <Notice icon={<Landmark className="h-6 w-6" />} title="Busy right now" body={setup.error} />
      ) : step === "amount" ? (
        <>
          <div className="flex flex-col items-center gap-3 pt-1">
            <label htmlFor="cashout-amount" className="label-mono text-[10px] text-muted-foreground">You cash out</label>
            <div className="flex items-baseline gap-2">
              <input
                id="cashout-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0"
                value={groupDigits(amount)}
                onChange={(e) => setAmount(cleanAmount(e.target.value.replace(/,/g, "")))}
                className="w-[9ch] bg-transparent text-right font-display text-[44px] font-extrabold leading-none tabular-nums text-ink outline-none placeholder:text-muted-foreground/40"
              />
              <span className="font-display text-[22px] font-extrabold text-muted-foreground">G$</span>
            </div>
            <span className="label-mono text-[10px] text-muted-foreground">Balance {fmtG(balanceG)} G$</span>
            <div className="flex items-center gap-2">
              <button type="button" className={CHIP} onClick={() => setAmount(String(Math.floor(Math.min(balanceG * 0.25, maxG))))}>25%</button>
              <button type="button" className={CHIP} onClick={() => setAmount(String(Math.floor(Math.min(balanceG * 0.5, maxG))))}>50%</button>
              <button type="button" className={cn(CHIP, "border-ink bg-yellow")} onClick={() => setAmount(String(Math.min(balanceG, maxG)))}>Max</button>
            </div>
          </div>

          <QuoteCard quote={quote} loading={quoting && !!amount} error={amountProblem || quoteErr} empty={!amount} />

          <GameButton variant="ink" full disabled={!amountReady} onClick={() => setStep("bank")}>Continue</GameButton>
          <RecentCashOuts wallet={address} onOpen={flow.open} />
        </>
      ) : step === "bank" ? (
        <>
          {picked !== null ? (
            <div className="flex flex-col gap-3">
              <p className="label-mono text-[10px] text-muted-foreground">Send it to</p>
              <ul className="flex flex-col gap-2.5">
                {saved.map((a, i) => (
                  <li key={a.bankCode + a.accountNumber}>
                    <button type="button" onClick={() => setPicked(i)} aria-pressed={picked === i} className="w-full rounded-2xl text-left">
                      <AccountCard account={a} selected={picked === i} />
                    </button>
                  </li>
                ))}
              </ul>
              <div className="flex items-center justify-between gap-3">
                <button type="button" onClick={() => setPicked(null)} className="flex items-center gap-1.5 text-[13px] font-bold text-blue">
                  <Plus className="h-4 w-4" /> Another account
                </button>
                <button
                  type="button"
                  onClick={() => { const list = forgetAccount(address, saved[picked]); setSaved(list); setPicked(list.length ? 0 : null); }}
                  className="text-[13px] font-bold text-muted-foreground hover:text-orange"
                >
                  Remove
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <span className="label-mono text-[10px] text-muted-foreground">Bank</span>
                <button type="button" onClick={() => setStep("banks")} className={cn(INPUT, "flex items-center justify-between text-left")}>
                  <span className={cn("truncate", !bank && "text-muted-foreground/60")}>{bank?.name ?? "Choose your bank"}</span>
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted-foreground" />
                </button>
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="cashout-account" className="label-mono text-[10px] text-muted-foreground">Account number</label>
                <div className="relative">
                  <input
                    id="cashout-account"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder="10 digits"
                    maxLength={10}
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className={cn(INPUT, "pr-12 tracking-[0.08em]")}
                  />
                  {verifying ? <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" /> : null}
                </div>
              </div>
              {accountName && bank ? (
                <AccountCard account={{ bankCode: bank.code, bankName: bank.name, accountNumber, accountName }} selected />
              ) : null}
              {verifyErr ? <p role="status" className="-mt-1 text-[13px] font-semibold text-orange">{verifyErr}</p> : null}
              {saved.length > 0 ? (
                <button type="button" onClick={() => setPicked(0)} className="self-start text-[13px] font-bold text-blue">Use a saved account</button>
              ) : null}
            </div>
          )}
          <GameButton
            variant="ink"
            full
            disabled={!account}
            onClick={() => {
              if (!account) return;
              const list = rememberAccount(address, account);
              setSaved(list); setPicked(0); setBank(null); setAccountNumber("");
              flow.reset(); setStep("review");
            }}
          >
            Continue
          </GameButton>
          <p className="-mt-2 text-center text-[11px] text-muted-foreground">Your own account only. Saved on this device.</p>
        </>
      ) : step === "banks" ? (
        <BankList banks={setup.banks ?? []} onPick={(b) => { setBank(b); setStep("bank"); }} />
      ) : (
        <Review
          amount={amount}
          quote={quote}
          quoting={quoting}
          account={account}
          phase={phase}
          onConfirm={confirm}
          onChangeAccount={() => setStep("bank")}
          onEditAmount={() => { flow.reset(); setStep("amount"); }}
        />
      )}

      {inNigeria ? <p className="-mt-1 text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">Powered by GoodCash</p> : null}
    </div>
  );
}

// ── Pieces ──────────────────────────────────────────────────────────────────

function useQuoteTick(on: boolean) {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!on) return;
    const t = setInterval(() => setN((x) => x + 1), 25_000);
    return () => clearInterval(t);
  }, [on]);
  return n;
}

function Notice({ icon, title, body, children }: { icon: React.ReactNode; title: string; body: string; children?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 py-3 text-center">
      <span className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink bg-yellow text-ink">{icon}</span>
      <p className="font-display text-[18px] font-extrabold uppercase leading-tight">{title}</p>
      <p className="max-w-[300px] text-[13px] leading-snug text-muted-foreground">{body}</p>
      {children ? <div className="mt-2 w-full">{children}</div> : null}
    </div>
  );
}

function QuoteCard({ quote, loading, error, empty }: { quote: Quote | null; loading: boolean; error: string; empty: boolean }) {
  const [open, setOpen] = useState(false);
  if (error) {
    return (
      <div role="status" className="flex items-center gap-2.5 rounded-2xl border-2 border-orange/40 bg-orange/10 px-4 py-3 text-[13px] font-semibold text-orange">
        <AlertCircle className="h-5 w-5 shrink-0" /> {error}
      </div>
    );
  }
  const totalFeeNaira = quote ? quote.fees.reduce((s, f) => s + (f.naira ?? 0), 0) : 0;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border-2 border-line bg-white px-4 py-3.5">
      <div className="flex items-center justify-between gap-3">
        <span className="label-mono text-[10px] text-muted-foreground">You get</span>
        {loading || (!quote && !empty) ? (
          <span className="h-6 w-24 animate-pulse rounded-full bg-muted" />
        ) : (
          <span className="font-display text-[24px] font-extrabold leading-none tabular-nums text-green-edge">{quote ? formatNaira(quote.receive.naira) : "₦0"}</span>
        )}
      </div>
      {quote && !loading ? (
        <>
          <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex items-center justify-between text-[12px] font-semibold text-muted-foreground">
            <span>Fees {formatNaira(totalFeeNaira)}</span>
            <ChevronDown className={cn("h-4 w-4 transition-transform", open && "rotate-180")} />
          </button>
          {open ? <FeeLines quote={quote} /> : null}
        </>
      ) : null}
    </div>
  );
}

function FeeLines({ quote, bare }: { quote: Quote; bare?: boolean }) {
  return (
    <ul className={cn("flex flex-col gap-2 text-[12px]", !bare && "border-t border-line pt-3")}>
      {quote.fees.map((f) => (
        <li key={f.type + f.label} className="flex items-start justify-between gap-3">
          <span className="text-muted-foreground">
            {f.label}
            {typeof f.percent === "number" && f.percent > 0 && !f.label.includes("%") ? ` (${f.percent}%)` : ""}
          </span>
          <span className="shrink-0 font-bold tabular-nums">
            {typeof f.naira === "number" ? formatNaira(f.naira) : f.amountG ? `${fmtG(Number(f.amountG))} G$` : ""}
          </span>
        </li>
      ))}
      {quote.nairaPerDollar > 0 ? <li className="pt-1 text-[11px] text-muted-foreground">Rate {formatNaira(quote.nairaPerDollar)} per $1</li> : null}
    </ul>
  );
}

function AccountCard({ account, selected }: { account: SavedAccount; selected?: boolean }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border-2 px-4 py-3", selected ? "border-ink bg-yellow/20" : "border-line bg-white")}>
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white">
        <Landmark className="h-4 w-4 text-ink" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-[14px] font-extrabold leading-tight">{account.accountName}</p>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{account.bankName} ••{account.accountNumber.slice(-4)}</p>
      </div>
      {selected ? (
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-ink text-white"><Check className="h-3 w-3" strokeWidth={3} /></span>
      ) : null}
    </div>
  );
}

function BankList({ banks, onPick }: { banks: Bank[]; onPick: (b: Bank) => void }) {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    const all = [...banks].sort((a, b) => a.name.localeCompare(b.name));
    return s ? all.filter((b) => b.name.toLowerCase().includes(s)) : all;
  }, [banks, q]);
  const popular = q ? [] : banks.filter((b) => b.popular);
  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search banks" aria-label="Search banks" className={cn(INPUT, "pl-11")} />
      </div>
      {popular.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {popular.map((b) => (
            <button key={b.code} type="button" onClick={() => onPick(b)} className="rounded-full border-2 border-line bg-white px-3.5 py-2 text-[12px] font-bold hover:border-ink">
              {b.name}
            </button>
          ))}
        </div>
      ) : null}
      {list.length === 0 ? (
        <p className="py-4 text-center text-[13px] text-muted-foreground">No bank matches &ldquo;{q}&rdquo;.</p>
      ) : (
        <ul className="max-h-[44dvh] divide-y divide-line overflow-y-auto">
          {list.map((b) => (
            <li key={b.code}>
              <button type="button" onClick={() => onPick(b)} className="flex w-full items-center justify-between gap-3 px-1 py-3 text-left text-[14px] font-semibold hover:text-blue">
                <span className="truncate">{b.name}</span>
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Review({
  amount, quote, quoting, account, phase, onConfirm, onChangeAccount, onEditAmount,
}: {
  amount: string; quote: Quote | null; quoting: boolean; account: SavedAccount | null; phase: CashOutPhase;
  onConfirm: () => void; onChangeAccount: () => void; onEditAmount: () => void;
}) {
  const working = phase.kind === "creating" || phase.kind === "signing";
  const error = phase.kind === "error" ? phase.message : "";
  const limitHit = phase.kind === "error" && (phase.code === "amount_too_large" || phase.code === "amount_too_small");
  if (!quote || !account) return null;
  return (
    <>
      <div className="flex flex-col items-center gap-2 pt-1 text-center">
        <span className="label-mono text-[10px] text-muted-foreground">You get</span>
        <span className="font-display text-[40px] font-extrabold leading-none tabular-nums text-green-edge">{formatNaira(quote.receive.naira)}</span>
      </div>
      <div className="divide-y divide-line rounded-2xl border-2 border-line bg-white">
        <div className="flex flex-col gap-1 px-4 py-3.5">
          <div className="flex items-center justify-between gap-3">
            <span className="label-mono text-[10px] text-muted-foreground">To</span>
            {!working ? <button type="button" onClick={onChangeAccount} className="text-[12px] font-bold text-blue">Change</button> : null}
          </div>
          <p className="break-words text-[14px] font-extrabold">{account.accountName}</p>
          <p className="text-[12px] text-muted-foreground">{account.bankName} ••{account.accountNumber.slice(-4)}</p>
        </div>
        <div className="flex items-center justify-between gap-4 px-4 py-3.5">
          <span className="label-mono shrink-0 text-[10px] text-muted-foreground">You send</span>
          <div className="flex items-center gap-3 text-[14px] font-extrabold tabular-nums">
            {fmtG(Number(amount))} G$
            {!working ? <button type="button" onClick={onEditAmount} className="text-[12px] font-bold text-blue">Edit</button> : null}
          </div>
        </div>
        <div className="px-4 py-3.5"><FeeLines quote={quote} bare /></div>
      </div>

      <div className="flex flex-col gap-3">
        <GameButton variant="green" full onClick={limitHit ? onEditAmount : onConfirm} disabled={working || quoting}>
          {working ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
          {phase.kind === "creating" ? "Getting it ready…"
            : phase.kind === "signing" ? "Confirm in wallet…"
            : limitHit ? "Change amount"
            : error ? "Try again"
            : `Cash out ${formatNaira(quote.receive.naira)}`}
        </GameButton>
        {error ? (
          <p role="status" className="text-center text-[13px] font-semibold text-orange">{error}</p>
        ) : (
          <p className="flex items-center justify-center gap-1.5 text-center text-[11px] text-muted-foreground">
            <Clock className="h-3.5 w-3.5" /> Usually in your bank in minutes
          </p>
        )}
      </div>
    </>
  );
}

function Progress({
  phase, naira, accountName, bankLine, onDone, onAgain,
}: { phase: CashOutPhase; naira: number; accountName?: string; bankLine: string; onDone: () => void; onAgain: () => void }) {
  const c: CashOutView | null = phase.kind === "tracking" ? phase.cashOut : null;
  const status = c?.status ?? "sent";
  const paid = status === "paid";
  const bad = status === "failed" || status === "refunded" || status === "expired";

  if (bad) {
    const body = status === "expired"
      ? "This cash out closed before anything was sent. Nothing left your wallet."
      : "The bank couldn't be paid, so your money went back to your wallet in dollars (USDT). It's safe there.";
    return (
      <Notice icon={<AlertCircle className="h-6 w-6" />} title={status === "expired" ? "Cash out closed" : "Bank wasn't paid"} body={body}>
        <GameButton variant="ink" full onClick={onAgain}>Start again</GameButton>
      </Notice>
    );
  }

  const steps = [
    { label: "G$ sent", done: phase.kind === "tracking" && status !== "awaiting_signature" },
    { label: "Paying your bank", done: paid },
    { label: "Paid", done: paid },
  ];
  const activeIdx = steps.findIndex((s) => !s.done);

  return (
    <div className="flex flex-col gap-5" role="status" aria-live="polite">
      <div className="flex flex-col items-center gap-3 pt-1 text-center">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-full border-2 border-ink", paid ? "bg-green text-ink" : "bg-yellow text-ink")}>
          {paid ? <Check className="h-6 w-6" strokeWidth={2.5} /> : <Loader2 className="h-6 w-6 animate-spin" />}
        </span>
        <span className="font-display text-[36px] font-extrabold leading-none tabular-nums">{formatNaira(naira)}</span>
        <div className="flex flex-col items-center gap-0.5 text-[13px] text-muted-foreground">
          <span>{paid ? "paid to" : phase.kind === "checking" ? "Checking on your cash out…" : "on its way to"}</span>
          {accountName && phase.kind !== "checking" ? (
            <>
              <span className="text-[14px] font-extrabold text-ink">{accountName}</span>
              {bankLine ? <span>{bankLine}</span> : null}
            </>
          ) : null}
        </div>
      </div>

      <ol className="flex flex-col gap-3 px-1">
        {steps.map((s, i) => (
          <li key={s.label} className="flex items-center gap-3">
            <span className={cn(
              "flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
              s.done ? "bg-ink text-white" : i === activeIdx ? "bg-yellow text-ink" : "bg-muted text-muted-foreground",
            )}>
              {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : i === activeIdx ? <Loader2 className="h-3 w-3 animate-spin" /> : <span className="h-1.5 w-1.5 rounded-full bg-current" />}
            </span>
            <span className={cn("text-[14px] font-bold", !(s.done || i === activeIdx) && "text-muted-foreground")}>{s.label}</span>
          </li>
        ))}
      </ol>

      {paid ? (
        <GameButton variant="ink" full onClick={onDone}>Done</GameButton>
      ) : (
        <p className="-mt-2 text-center text-[11px] text-muted-foreground">
          {phase.kind === "checking" ? "Don't send it again. We're checking it went through." : "Takes a few minutes. You can close this."}
        </p>
      )}
    </div>
  );
}

function RecentCashOuts({ wallet, onOpen }: { wallet: string; onOpen: (c: CashOutView) => void }) {
  const [list, setList] = useState<CashOutView[] | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/cashout?wallet=${wallet}`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        const items = ((d.data ?? []) as CashOutView[]).filter((c) => c.status !== "awaiting_signature" && c.status !== "expired").slice(0, 5);
        setList(items);
        if (items.some((c) => c.status === "sent" || c.status === "processing")) setOpen(true);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [wallet]);
  if (!list || list.length === 0) return null;
  const label: Record<string, string> = { sent: "On its way", processing: "On its way", paid: "Paid", failed: "Returned", refunded: "Returned" };
  return (
    <div className="-mb-1 border-t border-line pt-4">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center justify-between gap-3 py-1">
        <span className="label-mono flex items-center gap-2 text-[10px] text-muted-foreground">
          Recent
          <span className="rounded-full bg-muted px-1.5 text-[10px] tabular-nums text-ink">{list.length}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div className="flex flex-col gap-1 pt-2">
          {list.map((c) => (
            <button key={c.id} type="button" onClick={() => onOpen(c)} className="flex items-center justify-between gap-3 py-2 text-left">
              <span className="min-w-0">
                <span className="block text-[14px] font-extrabold tabular-nums">{formatNaira(c.naira)}</span>
                <span className="block text-[11px] text-muted-foreground">
                  {fmtG(Number(c.amountG))} G$ · {new Date(c.createdAt).toLocaleDateString("en-NG", { day: "numeric", month: "short" })}
                </span>
              </span>
              <span className={cn(
                "shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase",
                c.status === "paid" ? "bg-green/30 text-ink" : c.status === "failed" || c.status === "refunded" ? "bg-muted text-ink" : "bg-yellow text-ink",
              )}>
                {label[c.status] ?? c.status}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

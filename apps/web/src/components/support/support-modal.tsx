"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Loader2 } from "lucide-react";
import { erc20Abi, formatUnits } from "viem";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Coin, GameButton, Lulu } from "@/components/ds";
import { UserAvatar } from "@/components/ui/user-avatar";
import { creatorName } from "@/components/support/support-delulu-card";
import { useAuth } from "@/hooks/use-auth";
import { useTokenBalance } from "@/hooks/use-token-balance";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { useGoodDollarPrice } from "@/hooks/use-gooddollar-price";
import { useRedirectToSignIn } from "@/hooks/use-redirect-to-sign-in";
import { GOODDOLLAR_ADDRESSES } from "@/lib/constant";
import { formatUsdFromG } from "@/lib/rewards/summary";
import { SUPPORT_PRESET_AMOUNTS, parseSupportAmount } from "@/lib/support/rules";
import {
  createIntent,
  forgetSupportTx,
  pollSupport,
  rememberSupportTx,
  reportTx,
} from "@/lib/support/pending-support";
import type { PublicDeluluDto } from "@/lib/support/server";
import { cn } from "@/lib/utils";
import { fireConfetti } from "@/lib/celebrate";
import { Share2 } from "lucide-react";

type Step = "amount" | "confirm" | "signing" | "confirming" | "done" | "slow" | "error";

const G = GOODDOLLAR_ADDRESSES.mainnet as `0x${string}`;
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });
const short = (n: number) => (n >= 1000 && n % 1000 === 0 ? `${n / 1000}K` : fmt(n));

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

function walletErrorMessage(err: unknown): string {
  const m = err instanceof Error ? err.message : String(err ?? "");
  if (/reject|denied|cancel/i.test(m)) return "You cancelled in your wallet.";
  if (/insufficient funds|gas/i.test(m)) return "You need a little CELO for gas.";
  return "The transfer didn't go through.";
}

export function SupportModal({
  delulu,
  open,
  onOpenChange,
  initialAmount,
}: {
  /** Quick "+5K" from a card: opens straight on the confirm step. */
  initialAmount?: number;
  delulu: Pick<PublicDeluluDto, "id" | "title" | "creator" | "accepting"> | null;
  open: boolean;
  onOpenChange: (_o: boolean) => void;
}) {
  const { address, authenticated } = useAuth();
  const { redirectToSignIn } = useRedirectToSignIn();
  const { balance, refetch: refetchBalance } = useTokenBalance(G);
  const { writeContractAsync } = useUnifiedWriteContract();
  const { usd } = useGoodDollarPrice();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<Step>("amount");
  const [preset, setPreset] = useState<number | null>(SUPPORT_PRESET_AMOUNTS[0]);
  const [custom, setCustom] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [sentG, setSentG] = useState(0);
  const [copied, setCopied] = useState(false);
  const requestId = useRef<string | null>(null);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const quick = initialAmount != null && (SUPPORT_PRESET_AMOUNTS as readonly number[]).includes(initialAmount);
    setPreset(quick ? initialAmount! : SUPPORT_PRESET_AMOUNTS[0]);
    setCustom("");
    setError(null);
    setTxHash(null);
    requestId.current = quick ? newRequestId() : null;
    setStep(quick ? "confirm" : "amount");
  }, [open, delulu?.id, initialAmount]);

  useEffect(() => {
    if (step === "done") void fireConfetti();
  }, [step]);

  const share = async () => {
    if (!delulu) return;
    const url = `${window.location.origin}/support/${delulu.id}`;
    const text = `I just backed ${creatorName(delulu)}'s Delulu: "${delulu.title}". Back them too 💪`;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: "Delulu", text, url });
        return;
      }
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      // share sheet dismissed
    }
  };

  const raw = custom.trim() ? custom : preset != null ? String(preset) : "";
  const parsed = useMemo(() => parseSupportAmount(raw), [raw]);
  const balanceWhole = balance ? Number(formatUnits(balance.value, balance.decimals)) : null;
  const tooMuch = parsed.ok && balance ? parsed.wei > balance.value : false;
  const amountError = !raw ? null : !parsed.ok ? parsed.error : tooMuch ? "More than your balance" : null;
  const busy = step === "signing" || step === "confirming";

  const refreshAfter = () => {
    void queryClient.invalidateQueries({ queryKey: ["support-delulu", String(delulu?.id)] });
    void queryClient.invalidateQueries({ queryKey: ["support-feed"] });
    void queryClient.invalidateQueries({ queryKey: ["my-support"] });
    void refetchBalance();
  };

  const send = async () => {
    if (!delulu || !address || !parsed.ok) return;
    setError(null);
    setStep("signing");
    // Fixed per Continue tap: a re-sent create returns the same record, never a second one.
    if (!requestId.current) requestId.current = newRequestId();

    const intent = await createIntent({ deluluId: delulu.id, amount: raw, clientRequestId: requestId.current });
    if (!intent.ok) {
      setError(intent.error);
      setStep("error");
      return;
    }
    if (intent.data.status === "confirmed") {
      setSentG(intent.data.amountG);
      setTxHash(intent.data.txHash);
      setStep("done");
      return;
    }

    let hash: `0x${string}`;
    try {
      hash = await writeContractAsync({
        address: intent.data.token as `0x${string}`,
        abi: erc20Abi,
        functionName: "transfer",
        args: [intent.data.to as `0x${string}`, BigInt(intent.data.amountWei)],
      });
    } catch (err) {
      setError(walletErrorMessage(err));
      setStep("error");
      // Nothing was sent; a fresh tap gets a fresh record.
      requestId.current = null;
      return;
    }

    rememberSupportTx(intent.data.id, hash, address);
    setTxHash(hash);
    setSentG(intent.data.amountG);
    setStep("confirming");

    // The server confirms from the chain — a wallet hash alone isn't success.
    let result = await reportTx(intent.data.id, hash);
    for (let i = 0; i < 20 && result.ok && result.data.status === "submitted"; i++) {
      await new Promise((r) => setTimeout(r, 3_000));
      result = await pollSupport(intent.data.id);
    }
    if (!alive.current) return;

    if (result.ok && result.data.status === "confirmed") {
      forgetSupportTx(intent.data.id);
      setStep("done");
      refreshAfter();
    } else if (result.ok && result.data.status === "failed") {
      forgetSupportTx(intent.data.id);
      setError(result.data.error ?? "The transfer failed.");
      setStep("error");
      requestId.current = null;
      refreshAfter();
    } else {
      // Still settling or network trouble: the hash is saved and the cron finishes it.
      setStep("slow");
      refreshAfter();
    }
  };

  if (!delulu) return null;
  const usdLabel = parsed.ok ? formatUsdFromG(parsed.whole, usd) : null;

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => {
        if (!busy) onOpenChange(o);
      }}
      title="Support"
      modalClassName="max-w-md"
    >
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex items-center gap-3 rounded-[20px] bg-paper px-3.5 py-3">
          <UserAvatar address="0x0000" username={delulu.creator.username} pfpUrl={delulu.creator.pfpUrl} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate font-extrabold">{creatorName(delulu)}</div>
            <div className="truncate text-[13px] text-muted-foreground">{delulu.title}</div>
          </div>
        </div>

        {!authenticated ? (
          <GameButton full onClick={() => redirectToSignIn()}>
            Sign in to support
          </GameButton>
        ) : step === "amount" ? (
          <>
            <div className="grid grid-cols-2 gap-2">
              {SUPPORT_PRESET_AMOUNTS.map((a) => {
                const on = !custom.trim() && preset === a;
                return (
                  <button
                    key={a}
                    type="button"
                    onClick={() => {
                      setPreset(a);
                      setCustom("");
                    }}
                    className={cn(
                      "press-edge flex h-14 items-center justify-center gap-1.5 rounded-2xl border-2 text-[17px] font-extrabold tabular-nums",
                      on ? "border-ink bg-ink text-white shadow-[0_3px_0_#000]" : "border-line bg-white shadow-edge-sm",
                    )}
                  >
                    <Coin size={20} /> {short(a)}
                  </button>
                );
              })}
            </div>
            <label className="flex h-14 items-center gap-2 rounded-2xl border-2 border-line bg-white px-4 focus-within:border-ink">
              <input
                inputMode="decimal"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^\d.,]/g, ""))}
                placeholder="Custom amount"
                aria-label="Custom amount in G$"
                className="min-w-0 flex-1 bg-transparent text-[17px] font-bold tabular-nums outline-none placeholder:font-semibold placeholder:text-faint"
              />
              <span className="font-extrabold text-muted-foreground">G$</span>
            </label>
            <div className="flex justify-between text-[12px] font-semibold">
              <span className={amountError ? "text-orange" : "text-muted-foreground"}>
                {amountError ?? (usdLabel ? `≈ ${usdLabel}` : " ")}
              </span>
              <span className="text-muted-foreground tabular-nums">
                Balance: {balanceWhole == null ? "…" : `${fmt(balanceWhole)} G$`}
              </span>
            </div>
            <GameButton full disabled={!parsed.ok || tooMuch || !delulu.accepting} onClick={() => {
                requestId.current = newRequestId();
                setStep("confirm");
              }}>
              Continue
            </GameButton>
          </>
        ) : step === "confirm" ? (
          <>
            <div className="py-2 text-center">
              <div className="label-mono text-[10px] text-muted-foreground">You&apos;re sending</div>
              <div className="mt-1 flex items-center justify-center gap-2 font-display text-[40px] font-extrabold leading-none tabular-nums">
                <Coin size={34} /> {parsed.ok ? fmt(parsed.whole) : ""}
                <span className="text-[22px]">G$</span>
              </div>
              {usdLabel ? <div className="mt-1 text-sm text-muted-foreground">≈ {usdLabel}</div> : null}
              <p className="label-mono m-0 mt-3 text-[10px] text-muted-foreground">
                Straight to {creatorName(delulu)} · no fees
              </p>
            </div>
            {tooMuch ? (
              <p className="m-0 text-center text-[13px] font-semibold text-orange">
                More than your balance ({balanceWhole == null ? "…" : `${fmt(balanceWhole)} G$`})
              </p>
            ) : null}
            <GameButton full variant="green" disabled={tooMuch || !parsed.ok} onClick={() => void send()}>
              Confirm & send
            </GameButton>
            <button type="button" onClick={() => setStep("amount")} className="p-2 text-sm font-semibold text-muted-foreground">
              Back
            </button>
          </>
        ) : busy ? (
          <div className="flex flex-col items-center gap-3 py-6 text-center">
            <Loader2 className="h-9 w-9 animate-spin text-ink" />
            <p className="m-0 font-extrabold">{step === "signing" ? "Confirm in your wallet" : "Sending your support…"}</p>
            {txHash ? <TxLink hash={txHash} /> : null}
          </div>
        ) : step === "done" ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <Lulu size={84} mood="kept" wave />
            <p className="m-0 font-display text-[30px] font-extrabold uppercase leading-none">Sent!</p>
            <p className="m-0 text-sm text-muted-foreground">
              {fmt(sentG)} G$ to {creatorName(delulu)}
            </p>
            {txHash ? <TxLink hash={txHash} /> : null}
            <GameButton full variant="green" className="mt-3" onClick={() => void share()}>
              <Share2 className="h-4 w-4" strokeWidth={2.4} /> {copied ? "Link copied!" : "Share it"}
            </GameButton>
            <button type="button" onClick={() => onOpenChange(false)} className="p-2 text-sm font-semibold text-muted-foreground">
              Done
            </button>
          </div>
        ) : step === "slow" ? (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <Lulu size={72} />
            <p className="m-0 font-extrabold">Still confirming</p>
            <p className="m-0 text-sm text-muted-foreground">We&apos;ll notify you when it lands.</p>
            {txHash ? <TxLink hash={txHash} /> : null}
            <GameButton full variant="line" className="mt-3" onClick={() => onOpenChange(false)}>
              Close
            </GameButton>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-2 text-center">
            <Lulu size={72} mood="worried" />
            <p className="m-0 font-extrabold">{error ?? "Something went wrong"}</p>
            {txHash ? <TxLink hash={txHash} /> : null}
            <GameButton full className="mt-3" onClick={() => setStep("amount")}>
              Try again
            </GameButton>
          </div>
        )}
      </div>
    </ResponsiveSheet>
  );
}

function TxLink({ hash }: { hash: string }) {
  return (
    <a
      href={`https://celoscan.io/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1 text-[13px] font-bold text-ink"
    >
      View on CeloScan <ExternalLink className="h-3.5 w-3.5" />
    </a>
  );
}

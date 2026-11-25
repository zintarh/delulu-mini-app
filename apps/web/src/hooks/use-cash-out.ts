"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePublicClient } from "wagmi";
import { erc20Abi, parseUnits, type Address, type Hex } from "viem";
import { useAuth } from "@/hooks/use-auth";
import { useUnifiedWriteContract } from "@/hooks/use-unified-write-contract";
import { CELO_MAINNET_ID } from "@/lib/constant";
import { isInsufficientGasError } from "@/lib/contract-error";
import {
  CASH_OUT_PAID_EVENT, GOODCASH_ROUTER, G_TOKEN, TRANSFER_AND_CALL_ABI, checkCashOutTx, isFinal,
  type Bank, type CashOutOrder, type CashOutTx, type CashOutView, type FeeLine, type Quote,
} from "@/lib/cashout/goodcash";

// The cash-out flow, start to finish. Screens read `phase` and call the actions;
// everything that touches money lives here.
//
//   create (our server) → check the transaction ourselves → wallet sends it
//   → tell GoodCash the hash → follow it until the bank is paid.
//
// Once the wallet may have sent, we never offer "try again": a lost reply is
// looked up on chain, and anything unclear becomes "checking", never a resend.

export interface CashOutSetup {
  enabled: boolean;
  mode?: "live" | "test";
  minimumG?: number;
  maximumG?: number;
  feePercent?: number;
  banks?: Bank[];
  error?: string;
}

export type CashOutPhase =
  | { kind: "idle" }
  | { kind: "creating" }
  | { kind: "signing" }
  | { kind: "sending"; id: string }
  | { kind: "tracking"; cashOut: CashOutView }
  | { kind: "checking"; id: string }
  | { kind: "error"; message: string; code?: string };

export interface SavedAccount { bankCode: string; bankName: string; accountNumber: string; accountName: string }

const ACTIVE_KEY = (w: string) => `delulu:cashout:active:${w.toLowerCase()}`;
const ACCOUNTS_KEY = (w: string) => `delulu:cashout:accounts:${w.toLowerCase()}`;
const MAX_SAVED = 3;

function read(k: string) { try { return localStorage.getItem(k); } catch { return null; } }
function write(k: string, v: string | null) { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* private mode */ } }
const sameAccount = (a: SavedAccount, b: SavedAccount) => a.bankCode === b.bankCode && a.accountNumber === b.accountNumber;

/** Bank accounts this player has used, newest first. On their own device only: never on our servers. */
export function loadSavedAccounts(wallet: string): SavedAccount[] {
  try {
    const list = JSON.parse(read(ACCOUNTS_KEY(wallet)) ?? "null");
    return Array.isArray(list) ? list.filter((a) => a && a.accountNumber && a.bankCode && a.accountName).slice(0, MAX_SAVED) : [];
  } catch { return []; }
}

export function rememberAccount(wallet: string, a: SavedAccount): SavedAccount[] {
  const list = [a, ...loadSavedAccounts(wallet).filter((x) => !sameAccount(x, a))].slice(0, MAX_SAVED);
  write(ACCOUNTS_KEY(wallet), JSON.stringify(list));
  return list;
}

export function forgetAccount(wallet: string, a: SavedAccount): SavedAccount[] {
  const list = loadSavedAccounts(wallet).filter((x) => !sameAccount(x, a));
  write(ACCOUNTS_KEY(wallet), JSON.stringify(list));
  return list;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newKey = () => {
  const b = new Uint8Array(12);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
};

async function api<T>(url: string, init?: RequestInit): Promise<{ ok: boolean; status: number; body: T & { error?: string; code?: string } }> {
  try {
    const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) } });
    const body = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, body };
  } catch {
    return { ok: false, status: 0, body: { error: "You seem to be offline. Check your connection and try again." } as T & { error: string } };
  }
}

const isRejected = (e: unknown) => {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  return /user rejected|user denied|rejected the request|cancell?ed|4001/i.test(msg);
};

export function useCashOut() {
  const { address } = useAuth();
  const publicClient = usePublicClient({ chainId: CELO_MAINNET_ID });
  const { writeContractAsync } = useUnifiedWriteContract();
  const [phase, setPhase] = useState<CashOutPhase>({ kind: "idle" });
  const watching = useRef<string | null>(null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  /** A payment from this wallet to this order's payout address in the last ~40 minutes of blocks. */
  const findOnChain = useCallback(async (wallet: Address, payTo: Address): Promise<Hex | null> => {
    if (!publicClient) return null;
    try {
      const latest = await publicClient.getBlockNumber();
      const logs = await publicClient.getLogs({
        address: GOODCASH_ROUTER, event: CASH_OUT_PAID_EVENT,
        args: { user: wallet, payTo }, fromBlock: latest > 2400n ? latest - 2400n : 0n, toBlock: latest,
      });
      return logs.at(-1)?.transactionHash ?? null;
    } catch { return null; }
  }, [publicClient]);

  /** Follow a cash out until it's paid, failed, refunded or expired. */
  const watch = useCallback(async (id: string, first?: CashOutView) => {
    watching.current = id;
    let delay = 3000;
    let last = first;
    if (first) setPhase({ kind: "tracking", cashOut: first });
    while (alive.current && watching.current === id) {
      if (last && isFinal(last.status)) break;
      await sleep(delay);
      if (!alive.current || watching.current !== id) return;
      const r = await api<{ cashOut: CashOutView }>(`/api/cashout/${id}`);
      if (r.ok && r.body.cashOut) {
        const prev = last?.status;
        last = r.body.cashOut;
        setPhase({ kind: "tracking", cashOut: last });
        if (last.status !== prev) delay = 3000;
      }
      delay = Math.min(15_000, Math.round(delay * 1.5));
    }
    if (last && isFinal(last.status) && address) write(ACTIVE_KEY(address), null);
  }, [address]);

  /** Resume a cash out still in flight from an earlier visit (or another tab). */
  const resume = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    const id = read(ACTIVE_KEY(address));
    if (!id) return false;
    const r = await api<{ cashOut: CashOutView }>(`/api/cashout/${id}`);
    if (!r.ok || !r.body.cashOut) { if (r.status === 404) write(ACTIVE_KEY(address), null); return false; }
    const c = r.body.cashOut;
    if (c.status === "awaiting_signature") { write(ACTIVE_KEY(address), null); return false; }
    void watch(id, c);
    return true;
  }, [address, watch]);

  /** Report the hash until GoodCash sees it mined (202 = not yet). */
  const report = useCallback(async (id: string, hash: Hex) => {
    for (let i = 0; i < 40 && alive.current; i++) {
      const r = await api<{ cashOut: CashOutView }>(`/api/cashout/${id}/tx`, { method: "POST", body: JSON.stringify({ txHash: hash }) });
      if (r.status === 200 && r.body.cashOut) return r.body.cashOut;
      if (!r.ok && r.status !== 202 && r.status !== 0 && r.status < 500) break; // a real refusal: stop, keep following
      await sleep(3000);
    }
    return null;
  }, []);

  const start = useCallback(async (args: { amountG: string; quote: Quote; account: SavedAccount; mode: "live" | "test" }) => {
    if (!address) return;
    const wallet = address as Address;
    let amountWei: bigint;
    try { amountWei = parseUnits(args.amountG, 18); }
    catch { setPhase({ kind: "error", message: "Enter a valid amount." }); return; }

    setPhase({ kind: "creating" });
    const created = await api<{ cashOut: CashOutView; transaction: CashOutTx; order: CashOutOrder; fees: FeeLine[] }>("/api/cashout", {
      method: "POST",
      body: JSON.stringify({
        wallet, amountG: args.amountG, bankCode: args.account.bankCode, accountNumber: args.account.accountNumber,
        feePercentShown: args.quote.feePercent, attemptKey: newKey(),
      }),
    });
    if (!created.ok) {
      setPhase({ kind: "error", message: created.body.error ?? "Couldn't start the cash out. Nothing was sent.", code: created.body.code });
      return;
    }
    const { cashOut, transaction, order } = created.body;

    // Our own check, before the wallet sees anything.
    const check = checkCashOutTx(transaction, order, amountWei, { testMode: args.mode === "test" });
    if (!check.ok) {
      console.error("[cashout] refused transaction:", check.reason);
      setPhase({ kind: "error", message: "Something didn't look right with this cash out, so we stopped it. Nothing was sent.", code: "unsafe_transaction" });
      return;
    }
    rememberAccount(wallet, args.account);

    // Test keys: nothing is signed or sent. GoodCash plays the rest out.
    if (args.mode === "test") {
      write(ACTIVE_KEY(wallet), cashOut.id);
      setPhase({ kind: "sending", id: cashOut.id });
      const sim = await api<{ cashOut: CashOutView }>(`/api/cashout/${cashOut.id}/simulate`, { method: "POST" });
      if (!sim.ok) { setPhase({ kind: "error", message: sim.body.error ?? "The test cash out didn't start." }); return; }
      void watch(cashOut.id, sim.body.cashOut);
      return;
    }

    if (!publicClient) { setPhase({ kind: "error", message: "Couldn't reach the network. Try again in a moment." }); return; }
    const params = {
      address: G_TOKEN as Address,
      abi: TRANSFER_AND_CALL_ABI,
      functionName: "transferAndCall" as const,
      args: [GOODCASH_ROUTER, check.call.amountWei, check.call.data] as const,
    };
    try {
      const bal = await publicClient.readContract({ address: G_TOKEN as Address, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
      if (bal < amountWei) { setPhase({ kind: "error", message: "That's more G$ than you have. Lower the amount and try again." }); return; }
      await publicClient.simulateContract({ ...params, account: wallet });
    } catch {
      setPhase({ kind: "error", message: "This cash out wouldn't go through right now. Nothing was sent. Please try again." });
      return;
    }

    setPhase({ kind: "signing" });
    let hash: Hex | null = null;
    let sendErr: unknown = null;
    try {
      hash = await writeContractAsync(params);
    } catch (e) {
      sendErr = e;
    }
    if (!hash) {
      if (isRejected(sendErr)) { setPhase({ kind: "idle" }); return; } // closed the wallet: nothing sent
      if (isInsufficientGasError(sendErr)) { setPhase({ kind: "idle" }); return; } // the no-gas helper opened
      // Unclear whether it went out. Look for it before saying anything.
      write(ACTIVE_KEY(wallet), cashOut.id);
      setPhase({ kind: "checking", id: cashOut.id });
      for (let i = 0; i < 8 && !hash; i++) { hash = await findOnChain(wallet, order.payTo as Address); if (!hash) await sleep(4000); }
      if (!hash) {
        write(ACTIVE_KEY(wallet), null);
        setPhase({ kind: "error", message: "Your cash out didn't go through. Nothing left your wallet. Please try again." });
        return;
      }
    }

    write(ACTIVE_KEY(wallet), cashOut.id);
    setPhase({ kind: "sending", id: cashOut.id });
    const reported = await report(cashOut.id, hash);
    void watch(cashOut.id, reported ?? { ...cashOut, status: "sent", txHash: hash });
  }, [address, publicClient, writeContractAsync, report, watch, findOnChain]);

  const reset = useCallback(() => { watching.current = null; setPhase({ kind: "idle" }); }, []);
  const open = useCallback((c: CashOutView) => { void watch(c.id, c); }, [watch]);

  return { phase, start, reset, resume, open };
}

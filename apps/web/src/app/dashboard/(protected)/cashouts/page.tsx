"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { DashboardPage } from "@/components/dashboard/dashboard-ui";
import { adminFetch } from "@/components/admin/reward-engine-ui";
import { formatNaira } from "@/lib/cashout/goodcash";
import { cn } from "@/lib/utils";

type Health =
  | { configured: false }
  | {
      configured: true;
      mode: "live" | "test";
      shownToPlayers: boolean;
      partnerName: string | null;
      partnerFeePercent: number | null;
      webhookUrl: string | null;
      webhookReady: boolean;
      problem: { status: number; code: string; detail: string | null } | null;
    };

type Report = {
  configured: boolean;
  mode?: "live" | "test";
  count?: number;
  g?: number;
  naira?: number;
  people?: number;
  recent?: Array<{ id: string; wallet: string; amountG: number; naira: number; status: string; bank: string; txHash: string | null; createdAt: string; paidAt: string | null }>;
  health: Health;
  webhookUrl: string;
};

const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function Tile({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-background px-3 py-2.5">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-lg font-extrabold tabular-nums">{value}</p>
      {sub ? <p className="text-[11px] text-muted-foreground">{sub}</p> : null}
    </div>
  );
}

export default function CashOutsPage() {
  const [data, setData] = useState<Report | null>(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [connectMsg, setConnectMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setErr("");
    try { setData(await adminFetch<Report>("/api/dashboard/cashouts")); }
    catch (e) { setErr(e instanceof Error ? e.message : String(e)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const connect = async () => {
    setConnecting(true);
    setConnectMsg("");
    try {
      await adminFetch("/api/dashboard/cashouts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "connect-webhook" }) });
      setConnectMsg("Webhook connected.");
      await load();
    } catch (e) { setConnectMsg(e instanceof Error ? e.message : String(e)); }
    finally { setConnecting(false); }
  };

  const h = data?.health;

  return (
    <DashboardPage>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-extrabold">Cash outs</h1>
          <p className="text-sm text-muted-foreground">G$ to Nigerian bank accounts, through GoodCash.</p>
        </div>
        <button type="button" onClick={() => void load()} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-sm font-semibold">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {err ? <p className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-600">{err}</p> : null}

      {h ? (
        <section className="mt-5 rounded-xl border border-border p-4">
          <h2 className="text-sm font-extrabold uppercase tracking-wide">Connection</h2>
          {!h.configured ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Off. Set <code>GOODCASH_SECRET_KEY</code> (gc_sk_live_… or gc_sk_test_…) in Vercel and redeploy.
            </p>
          ) : (
            <div className="mt-2 space-y-1.5 text-sm">
              <p>Mode: <b>{h.mode}</b>{h.mode === "test" ? " (sandbox, no real money)" : ""} · Shown to players: <b>{h.shownToPlayers ? "yes" : "no"}</b>{h.mode === "test" && !h.shownToPlayers ? " (set GOODCASH_SHOW_TEST=1)" : ""}</p>
              <p>Partner: <b>{h.partnerName ?? "—"}</b> · GoodCash partner fee: <b>{h.partnerFeePercent == null ? "—" : `${h.partnerFeePercent}%`}</b></p>
              <p>
                Webhook: <b className={h.webhookReady ? "text-green-600" : "text-orange"}>{h.webhookReady ? "connected" : "not connected"}</b>
                {h.webhookUrl ? <span className="text-muted-foreground"> · {h.webhookUrl}</span> : null}
              </p>
              {!h.webhookReady ? (
                <div className="flex items-center gap-3 pt-1">
                  <button type="button" disabled={connecting} onClick={() => void connect()} className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-50">
                    {connecting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Connect webhook
                  </button>
                  <span className="text-xs text-muted-foreground">Registers {data?.webhookUrl}</span>
                </div>
              ) : null}
              {connectMsg ? <p className="text-xs text-muted-foreground">{connectMsg}</p> : null}
              {h.problem ? (
                <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-2 text-[11px]">{JSON.stringify(h.problem, null, 2)}</pre>
              ) : null}
            </div>
          )}
        </section>
      ) : null}

      {data?.configured ? (
        <>
          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Tile label="Paid cash outs" value={fmt(data.count ?? 0)} sub={data.mode === "test" ? "test mode" : undefined} />
            <Tile label="G$ cashed out" value={`${fmt(data.g ?? 0)} G$`} />
            <Tile label="Naira paid" value={formatNaira(data.naira ?? 0)} />
            <Tile label="Players" value={fmt(data.people ?? 0)} />
          </div>

          <section className="mt-5 overflow-x-auto rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Wallet</th><th className="px-3 py-2">G$</th><th className="px-3 py-2">Naira</th><th className="px-3 py-2">Bank</th><th className="px-3 py-2">Status</th></tr>
              </thead>
              <tbody>
                {(data.recent ?? []).length === 0 ? (
                  <tr><td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">No cash outs yet.</td></tr>
                ) : (data.recent ?? []).map((r) => (
                  <tr key={r.id} className="border-t border-border">
                    <td className="px-3 py-2 whitespace-nowrap">{new Date(r.createdAt).toLocaleString("en-GB", { timeZone: "Africa/Lagos", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</td>
                    <td className="px-3 py-2 font-mono text-xs">{r.wallet.slice(0, 6)}…{r.wallet.slice(-4)}</td>
                    <td className="px-3 py-2 tabular-nums">{fmt(r.amountG)}</td>
                    <td className="px-3 py-2 tabular-nums">{formatNaira(r.naira)}</td>
                    <td className="px-3 py-2">{r.bank}</td>
                    <td className="px-3 py-2">
                      {r.txHash ? <a href={`https://celoscan.io/tx/${r.txHash}`} target="_blank" rel="noopener noreferrer" className="underline">{r.status}</a> : r.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </DashboardPage>
  );
}

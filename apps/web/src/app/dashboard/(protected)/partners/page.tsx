"use client";

import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";
import { DashboardPage } from "@/components/dashboard/dashboard-ui";
import { adminFetch } from "@/components/admin/reward-engine-ui";

type Partner = { code: string; name: string; minPoints: number; active: boolean; ownerWallet: string | null; ownerUsername: string | null; brought: number };

const post = (body: unknown) => adminFetch("/api/dashboard/partners", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

export default function PartnersPage() {
  const [list, setList] = useState<Partner[] | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: "", name: "", minPoints: "100" });
  const [assign, setAssign] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    try { setList((await adminFetch<{ partners: Partner[] }>("/api/dashboard/partners")).partners); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true); setMsg("");
    try { await fn(); setMsg(ok); await load(); }
    catch (e) { setMsg(e instanceof Error ? e.message : String(e)); }
    finally { setBusy(false); }
  };

  return (
    <DashboardPage>
      <h1 className="text-xl font-extrabold">Partner links</h1>
      <p className="text-sm text-muted-foreground">A personal link like staydelulu.xyz/join/BIGJAY, with its own page where the partner follows their referrals.</p>
      {msg ? <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm">{msg}</p> : null}

      <section className="mt-5 space-y-2">
        {list == null ? <Loader2 className="h-5 w-5 animate-spin" /> : list.length === 0 ? <p className="text-sm text-muted-foreground">No partner links yet.</p> : list.map((p) => (
          <div key={p.code} className="rounded-xl border border-border p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-extrabold">{p.code} <span className="font-normal text-muted-foreground">· {p.name} · {p.minPoints.toLocaleString()} pts to complete</span></p>
                <p className="text-xs text-muted-foreground">
                  {p.ownerWallet ? <>Owner: {p.ownerUsername ? `@${p.ownerUsername}` : ""} <span className="font-mono">{p.ownerWallet}</span> · {p.brought} joined</> : <b className="text-orange">Not assigned yet: the link does nothing until it is.</b>}
                </p>
              </div>
              <a href={`/partner/${p.code}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-lg border border-border px-2.5 py-1 text-xs font-semibold">
                Partner page <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor={`owner-${p.code}`}>Owner wallet or username</label>
              <input id={`owner-${p.code}`} value={assign[p.code] ?? ""} onChange={(e) => setAssign({ ...assign, [p.code]: e.target.value })} placeholder="Owner's wallet or @username" className="min-w-[260px] flex-1 rounded-md border border-border bg-background px-2 py-1.5 text-xs" />
              <button type="button" disabled={busy || !(assign[p.code] ?? "").trim()} onClick={() => void run(() => post({ action: "assign", code: p.code, owner: assign[p.code] }), `${p.code} now belongs to ${assign[p.code]}.`)} className="rounded-md bg-foreground px-3 py-1.5 text-xs font-semibold text-background disabled:opacity-50">
                {p.ownerWallet ? "Reassign" : "Assign"}
              </button>
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-xl border border-border p-4">
        <h2 className="text-sm font-extrabold uppercase tracking-wide">New partner link</h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <label className="text-xs font-semibold">Code
            <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "") })} placeholder="BIGJAY" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs font-semibold">Name
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Big J" className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          </label>
          <label className="text-xs font-semibold">Points to complete
            <input inputMode="numeric" value={form.minPoints} onChange={(e) => setForm({ ...form, minPoints: e.target.value.replace(/\D/g, "") })} className="mt-1 w-full rounded-md border border-border bg-background px-2 py-1.5 text-sm" />
          </label>
        </div>
        <button type="button" disabled={busy || !form.code || !form.name} onClick={() => void run(() => post({ action: "save", code: form.code, name: form.name, minPoints: Number(form.minPoints) }), `Saved ${form.code}. Assign it to the partner's account next.`)} className="mt-3 rounded-md bg-foreground px-3 py-1.5 text-sm font-semibold text-background disabled:opacity-50">
          Save
        </button>
      </section>
    </DashboardPage>
  );
}

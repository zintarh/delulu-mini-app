// Server only. Talks to GoodCash with our secret key and keeps our own record
// of every cash out in Supabase (table `cashouts`, docs/migrations/20261124_cashouts.sql).
//
// Every status we store comes from GoodCash's own server (a signed webhook, or
// a status read with our secret key), never from a browser. Test-key rows are
// stored with mode = 'test' and never counted in the live totals.

import { createHmac, timingSafeEqual } from "crypto";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import type { CashOutStatus, CashOutView } from "@/lib/cashout/goodcash";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const API = "https://api.goodcash.xyz";

export type Mode = "live" | "test";

export function gcConfig(): { key: string; mode: Mode } | null {
  const key = process.env.GOODCASH_SECRET_KEY?.trim();
  if (!key) return null;
  if (key.startsWith("gc_sk_live_")) return { key, mode: "live" };
  if (key.startsWith("gc_sk_test_")) return { key, mode: "test" };
  return null; // a publishable key or anything else: refuse to run
}

/** Whether the app should offer cash out. Test mode only where we ask for it. */
export function cashOutEnabled(): boolean {
  const c = gcConfig();
  if (!c) return false;
  return c.mode === "live" || process.env.GOODCASH_SHOW_TEST === "1";
}

export interface GcError { code: string; message: string; status: number; detail?: string }
export type GcResult<T> = { ok: true; data: T; status: number } | { ok: false; error: GcError };

const FALLBACK_MSG = "Cash out is busy right now. Please try again in a moment.";

/** One GoodCash call. Never throws; errors come back in GoodCash's own plain words. */
export async function gc<T>(
  path: string,
  init: { method?: string; body?: unknown; idempotencyKey?: string; timeoutMs?: number } = {},
): Promise<GcResult<T>> {
  const cfg = gcConfig();
  if (!cfg) return { ok: false, error: { code: "not_configured", message: "Cash out isn't available yet.", status: 503 } };
  const headers: Record<string, string> = { Authorization: `Bearer ${cfg.key}`, Accept: "application/json" };
  if (init.body !== undefined) headers["Content-Type"] = "application/json";
  if (init.idempotencyKey) headers["Idempotency-Key"] = init.idempotencyKey;
  try {
    const res = await fetch(`${API}${path}`, {
      method: init.method ?? "GET",
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(init.timeoutMs ?? 15_000),
      cache: "no-store",
    });
    const text = await res.text();
    let body: unknown = null;
    try { body = JSON.parse(text); } catch { /* not JSON: e.g. a firewall page */ }
    if (!res.ok) {
      const e = (body as { error?: { code?: string; message?: string; detail?: string } } | null)?.error;
      const detail = e?.detail ?? (e ? undefined : JSON.stringify({ path, status: res.status, cfRay: res.headers.get("cf-ray"), body: text.slice(0, 500) }));
      console.warn(`[goodcash] ${path} ${res.status} ${e?.code ?? "non-json"}: ${detail ?? ""}`);
      return { ok: false, error: { code: e?.code ?? "unavailable", message: e?.message ?? FALLBACK_MSG, status: res.status, detail } };
    }
    return { ok: true, data: body as T, status: res.status };
  } catch (e) {
    console.warn(`[goodcash] ${path} failed`, e);
    return { ok: false, error: { code: "network_error", message: FALLBACK_MSG, status: 503 } };
  }
}

// ── GoodCash's cash-out object (only the fields we use) ───────────────────────

export interface GcCashOut {
  id: string;
  mode: Mode;
  status: CashOutStatus;
  wallet: string;
  amountG: string;
  receive?: { naira?: number; minimumNaira?: number };
  partnerRef?: string | null;
  txHash?: string | null;
  createdAt: string;
  paidAt?: string | null;
  expiresAt?: string;
}

// ── Our records ───────────────────────────────────────────────────────────────

export interface CashOutRow {
  id: string;
  mode: Mode;
  wallet: string;
  amount_g: number;
  naira: number;
  naira_per_dollar: number;
  account_name: string;
  bank_name: string;
  account_last4: string;
  status: CashOutStatus;
  tx_hash: string | null;
  created_at: string;
  paid_at: string | null;
}

export async function saveCashOut(admin: Admin, row: Omit<CashOutRow, "paid_at" | "tx_hash">) {
  const { error } = await admin.from("cashouts").upsert({ ...row, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) console.error("[cashout] save failed:", error.message);
}

export async function getCashOut(admin: Admin, id: string): Promise<CashOutRow | null> {
  const { data } = await admin.from("cashouts").select("*").eq("id", id).maybeSingle();
  return (data as CashOutRow | null) ?? null;
}

/**
 * Apply GoodCash's view of a cash out (from a verified webhook or a secret-key
 * read) to our row. Only ever moves status forward to what GoodCash says.
 */
export async function syncCashOut(admin: Admin, c: GcCashOut): Promise<CashOutRow | null> {
  const row = await getCashOut(admin, c.id);
  if (!row) return null; // not one of ours
  const naira = typeof c.receive?.naira === "number" ? c.receive.naira : row.naira;
  const patch = {
    status: c.status,
    naira,
    tx_hash: c.txHash ?? row.tx_hash,
    paid_at: c.status === "paid" ? (c.paidAt ?? row.paid_at ?? new Date().toISOString()) : row.paid_at,
    updated_at: new Date().toISOString(),
  };
  const { error } = await admin.from("cashouts").update(patch).eq("id", c.id);
  if (error) throw new Error(error.message);
  return { ...row, ...patch };
}

/** True the first time we see this webhook event id. */
export async function firstSight(admin: Admin, eventId: string): Promise<boolean> {
  const { error } = await admin.from("cashout_webhook_events").insert({ id: eventId });
  if (!error) return true;
  if (error.code === "23505") return false; // already handled
  throw new Error(error.message);
}

// ── Rate limits (per server instance) ─────────────────────────────────────────
// A light guard against abuse of the open bank-name lookup. GoodCash rate
// limits too; this keeps one caller from burning our share.

const hits = new Map<string, { n: number; until: number }>();

export function underLimit(kind: string, who: string | null, max: number, windowS: number): boolean {
  if (!who) return true;
  const k = `${kind}:${who}`;
  const now = Date.now();
  const h = hits.get(k);
  if (!h || h.until < now) {
    hits.set(k, { n: 1, until: now + windowS * 1000 });
    if (hits.size > 5000) for (const [key, v] of hits) if (v.until < now) hits.delete(key);
    return true;
  }
  h.n++;
  return h.n <= max;
}

// ── Webhook signatures ────────────────────────────────────────────────────────

/** GoodCash-Signature: t=<unix>,v1=<hex HMAC-SHA256(secret, "<t>.<raw body>")>, within 5 minutes. */
export function verifySignature(raw: string, header: string | null, secret: string, nowS = Date.now() / 1000): boolean {
  const m = /^t=(\d+),v1=([0-9a-f]{64})$/.exec(header ?? "");
  if (!m || Math.abs(nowS - Number(m[1])) > 300) return false;
  const want = createHmac("sha256", secret).update(`${m[1]}.${raw}`).digest("hex");
  return timingSafeEqual(Buffer.from(want), Buffer.from(m[2]));
}

// ── Shared by the routes ──────────────────────────────────────────────────────

export interface GcBank { code: string; name: string; popular?: boolean }
export interface GcLimits { minimumG: number; maximumG: number; feePercent: number }

let bankCache: { at: number; mode: Mode; banks: GcBank[] } | null = null;

/** The bank list changes rarely: keep it for an hour per server instance. */
export async function banks(): Promise<GcResult<GcBank[]>> {
  const mode = gcConfig()?.mode;
  if (bankCache && bankCache.mode === mode && Date.now() - bankCache.at < 3_600_000) {
    return { ok: true, data: bankCache.banks, status: 200 };
  }
  const r = await gc<{ data: GcBank[] }>("/v1/banks");
  if (!r.ok) return r;
  const list = (r.data.data ?? []).filter((b) => b && typeof b.code === "string" && typeof b.name === "string");
  if (mode) bankCache = { at: Date.now(), mode, banks: list };
  return { ok: true, data: list, status: 200 };
}

export const ADDR_RE = /^0x[0-9a-fA-F]{40}$/;
export const AMOUNT_RE = /^\d{1,12}(\.\d{1,6})?$/;
export const ACCOUNT_RE = /^\d{10}$/;
export const ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const TX_RE = /^0x[0-9a-fA-F]{64}$/;

/** What the app sees for one cash out. Bank details only from our own record. */
export function toView(c: GcCashOut, row: Partial<CashOutRow> | null): CashOutView {
  return {
    id: c.id,
    status: c.status,
    amountG: c.amountG,
    naira: typeof c.receive?.naira === "number" ? c.receive.naira : Number(row?.naira ?? 0),
    txHash: c.txHash ?? null,
    createdAt: c.createdAt,
    paidAt: c.paidAt ?? null,
    ...(row?.account_name ? { accountName: row.account_name, bankName: row.bank_name, accountLast4: row.account_last4 } : {}),
  };
}

// ── Webhook secret ────────────────────────────────────────────────────────────
// Set GOODCASH_WEBHOOK_SECRET by hand, or let an admin press "Connect webhook":
// the server registers our URL with its own key and keeps the secret GoodCash
// returns (shown once) in cashout_settings, so nobody has to copy it.

export async function webhookSecret(admin: Admin): Promise<string | null> {
  const env = process.env.GOODCASH_WEBHOOK_SECRET?.trim();
  if (env) return env;
  const cfg = gcConfig();
  if (!cfg) return null;
  const { data } = await admin.from("cashout_settings").select("webhook_secret").eq("mode", cfg.mode).maybeSingle();
  return (data?.webhook_secret as string | null) ?? null;
}

export async function connectWebhook(admin: Admin, url: string): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const cfg = gcConfig();
  if (!cfg) return { ok: false, error: "Cash out isn't configured (GOODCASH_SECRET_KEY)." };
  const current = await gc<{ url: string | null; hasSecret?: boolean }>("/v1/webhooks");
  if (!current.ok) return { ok: false, error: current.error.message };
  const have = await webhookSecret(admin);
  // A secret is only ever shown once: rotate if GoodCash has one we don't.
  const rotate = !!current.data.hasSecret && !have;
  const r = await gc<{ url: string; secret?: string }>("/v1/webhooks", { method: "PUT", body: { url, ...(rotate ? { rotateSecret: true } : {}) } });
  if (!r.ok) return { ok: false, error: r.error.message };
  if (r.data.secret) {
    const { error } = await admin
      .from("cashout_settings")
      .upsert({ mode: cfg.mode, webhook_secret: r.data.secret, updated_at: new Date().toISOString() }, { onConflict: "mode" });
    if (error) return { ok: false, error: `Couldn't save the signing secret: ${error.message} — run docs/migrations/20261124_cashouts.sql` };
  }
  if (!r.data.secret && !have) return { ok: false, error: "GoodCash didn't return a signing secret. Try again." };
  return { ok: true, url: r.data.url };
}

/** For the admin page: is everything in place? Never returns a secret. */
export async function cashOutHealth(admin: Admin) {
  const cfg = gcConfig();
  if (!cfg) return { configured: false as const };
  const [partner, hook, secret] = await Promise.all([
    gc<{ feePercent?: number; name?: string }>("/v1/partner"),
    gc<{ url: string | null; hasSecret?: boolean }>("/v1/webhooks"),
    webhookSecret(admin),
  ]);
  return {
    configured: true as const,
    mode: cfg.mode,
    shownToPlayers: cashOutEnabled(),
    partnerName: partner.ok ? partner.data.name ?? null : null,
    partnerFeePercent: partner.ok ? partner.data.feePercent ?? 0 : null,
    webhookUrl: hook.ok ? hook.data.url : null,
    webhookReady: hook.ok && !!hook.data.url && !!secret,
    // Admin only: GoodCash's raw answer when it refuses us (never shown to players).
    problem: partner.ok ? null : { status: partner.error.status, code: partner.error.code, detail: partner.error.detail ?? null },
  };
}

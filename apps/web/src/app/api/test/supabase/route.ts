/**
 * GET /api/test/supabase
 *
 * Development-only health check for every Supabase connection and table
 * used in this app. Returns a JSON report of each check so you can see
 * exactly which step is failing without hunting through logs.
 *
 * Checks performed:
 *   1. Env vars present  (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
 *   2. Client can be created
 *   3. Table: public.faucet_claims          — SELECT (read)
 *   4. Table: public.push_subscriptions     — SELECT (read)
 *   5. Table: public.push_events_sent       — SELECT (read)
 *   6. Write round-trip: INSERT + DELETE on faucet_claims (proves RLS / permissions)
 *
 * Blocked in production via NODE_ENV guard.
 */

import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

// ─── types ───────────────────────────────────────────────────────────────────

type Status = "ok" | "fail" | "skip";

interface CheckResult {
  status: Status;
  message: string;
  detail?: unknown;
  latencyMs?: number;
}

interface Report {
  timestamp: string;
  environment: string;
  checks: Record<string, CheckResult>;
  overall: "ok" | "degraded" | "fail";
}

// ─── helper ──────────────────────────────────────────────────────────────────

async function timed<T>(
  fn: () => PromiseLike<T>
): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

async function checkTable(
  supabase: SupabaseClient,
  table: string
): Promise<CheckResult> {
  const { result, latencyMs } = await timed(() =>
    supabase.from(table).select("*").limit(1).maybeSingle()
  );

  if (result.error) {
    return {
      status: "fail",
      message: `Query on "${table}" failed`,
      detail: result.error,
      latencyMs,
    };
  }

  return {
    status: "ok",
    message: `Table "${table}" is reachable`,
    detail: result.data ? "1 row returned" : "table exists, 0 rows",
    latencyMs,
  };
}

// ─── handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  // Block in production so this endpoint is never publicly exposed
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available in production" }, { status: 403 });
  }

  const checks: Record<string, CheckResult> = {};

  // ── 1. Environment variables ──────────────────────────────────────────────
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  checks["env.SUPABASE_URL"] = url
    ? { status: "ok", message: `Set → ${url}` }
    : { status: "fail", message: "Missing SUPABASE_URL in environment" };

  checks["env.SUPABASE_SERVICE_ROLE_KEY"] = serviceKey
    ? {
        status: "ok",
        message: `Set → ${serviceKey.slice(0, 20)}…`,
      }
    : {
        status: "fail",
        message: "Missing SUPABASE_SERVICE_ROLE_KEY in environment",
      };

  if (!url || !serviceKey) {
    return NextResponse.json(buildReport(checks), { status: 200 });
  }

  // ── 2. Client creation ────────────────────────────────────────────────────
  let supabase: SupabaseClient;
  try {
    supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    checks["client.create"] = {
      status: "ok",
      message: "createClient() succeeded",
    };
  } catch (err: any) {
    checks["client.create"] = {
      status: "fail",
      message: "createClient() threw an exception",
      detail: err?.message,
    };
    return NextResponse.json(buildReport(checks), { status: 200 });
  }

  // ── 3–5. Table read checks (in parallel) ─────────────────────────────────
  const [faucetCheck, pushSubCheck, pushEventsCheck] = await Promise.all([
    checkTable(supabase, "faucet_claims"),
    checkTable(supabase, "push_subscriptions"),
    checkTable(supabase, "push_events_sent"),
  ]);

  checks["table.faucet_claims"] = faucetCheck;
  checks["table.push_subscriptions"] = pushSubCheck;
  checks["table.push_events_sent"] = pushEventsCheck;

  // ── 6. Write round-trip on faucet_claims ─────────────────────────────────
  const testTxHash = `0xTEST_${Date.now()}_DELETE_ME`;
  const testAddress = "0x0000000000000000000000000000000000000001";

  const { result: insertResult, latencyMs: insertMs } = await timed(() =>
    supabase.from("faucet_claims").insert({
      address: testAddress,
      amount: 0,
      tx_hash: testTxHash,
    })
  );

  if (insertResult.error) {
    checks["write.faucet_claims.insert"] = {
      status: "fail",
      message: "Test INSERT into faucet_claims failed",
      detail: insertResult.error,
      latencyMs: insertMs,
    };
  } else {
    checks["write.faucet_claims.insert"] = {
      status: "ok",
      message: "Test INSERT succeeded",
      latencyMs: insertMs,
    };

    // Clean up the test row immediately
    const { result: deleteResult, latencyMs: deleteMs } = await timed(() =>
      supabase.from("faucet_claims").delete().eq("tx_hash", testTxHash)
    );

    checks["write.faucet_claims.delete"] = deleteResult.error
      ? {
          status: "fail",
          message: "Test DELETE (cleanup) failed — row left behind",
          detail: deleteResult.error,
          latencyMs: deleteMs,
        }
      : {
          status: "ok",
          message: "Test row cleaned up successfully",
          latencyMs: deleteMs,
        };
  }

  return NextResponse.json(buildReport(checks), { status: 200 });
}

// ─── report builder ───────────────────────────────────────────────────────────

function buildReport(checks: Record<string, CheckResult>): Report {
  const values = Object.values(checks);
  const hasFail = values.some((c) => c.status === "fail");
  const allOk = values.every((c) => c.status === "ok");

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "unknown",
    checks,
    overall: allOk ? "ok" : hasFail ? (values.some((c) => c.status === "ok") ? "degraded" : "fail") : "degraded",
  };
}

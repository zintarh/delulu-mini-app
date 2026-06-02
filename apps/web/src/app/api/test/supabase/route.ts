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
 *   3. Table: public.push_subscriptions     — SELECT (read)
 *   4. Table: public.push_events_sent       — SELECT (read)
 *
 * Blocked in production via NODE_ENV guard.
 */

import { NextResponse } from "next/server";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

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

async function timed<T>(
  fn: () => PromiseLike<T>,
): Promise<{ result: T; latencyMs: number }> {
  const start = Date.now();
  const result = await fn();
  return { result, latencyMs: Date.now() - start };
}

async function checkTable(
  supabase: SupabaseClient,
  table: string,
): Promise<CheckResult> {
  const { result, latencyMs } = await timed(() =>
    supabase.from(table).select("*").limit(1).maybeSingle(),
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

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json(
      { error: "Not available in production" },
      { status: 403 },
    );
  }

  const checks: Record<string, CheckResult> = {};

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

  let supabase: SupabaseClient;
  try {
    supabase = createClient(url, serviceKey, { auth: { persistSession: false } });
    checks["client.create"] = {
      status: "ok",
      message: "createClient() succeeded",
    };
  } catch (err: unknown) {
    checks["client.create"] = {
      status: "fail",
      message: "createClient() threw an exception",
      detail: err instanceof Error ? err.message : err,
    };
    return NextResponse.json(buildReport(checks), { status: 200 });
  }

  const [pushSubCheck, pushEventsCheck] = await Promise.all([
    checkTable(supabase, "push_subscriptions"),
    checkTable(supabase, "push_events_sent"),
  ]);

  checks["table.push_subscriptions"] = pushSubCheck;
  checks["table.push_events_sent"] = pushEventsCheck;

  return NextResponse.json(buildReport(checks), { status: 200 });
}

function buildReport(checks: Record<string, CheckResult>): Report {
  const values = Object.values(checks);
  const hasFail = values.some((c) => c.status === "fail");
  const allOk = values.every((c) => c.status === "ok");

  return {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV ?? "unknown",
    checks,
    overall: allOk
      ? "ok"
      : hasFail
        ? values.some((c) => c.status === "ok")
          ? "degraded"
          : "fail"
        : "degraded",
  };
}

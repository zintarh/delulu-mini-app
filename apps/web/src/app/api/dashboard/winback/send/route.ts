import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { requirePlatformAdmin } from "@/lib/dashboard/require-platform-admin";
import { normalizeMarketingAppUrl } from "@/lib/marketing-email-template";
import { invalidateOutreachCache, loadOutreachPeople, type OutreachPerson } from "@/lib/outreach/activity";
import { buildLuluEmailHtml, buildLuluEmailText } from "@/lib/outreach/email";
import { fillTemplate, findBlanks, formatEarned, formatLastActive, type MergeValues } from "@/lib/outreach/templates";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const MAX_RECIPIENTS = 500;
const BATCH = 100;

type Body = {
  wallets?: unknown;
  templateId?: unknown;
  subject?: unknown;
  heading?: unknown;
  body?: unknown;
  cta?: unknown;
  ctaPath?: unknown;
  /** Send one copy to the signed-in admin, filled with the first recipient's details. */
  test?: unknown;
  /** Also email people emailed in the last 3 days. */
  includeRecent?: unknown;
};

export type WinbackSendResult = {
  sent: number;
  failed: number;
  skippedNoEmail: number;
  skippedRecent: number;
  failures: { email: string; reason: string }[];
};

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function mergeFor(p: OutreachPerson): MergeValues {
  return {
    name: p.username || "dreamer",
    days: p.activeDays,
    earned: formatEarned(p.earnedGd, p.earnedUsdt),
    lastActive: formatLastActive(p.lastActive),
  };
}

/**
 * POST /api/dashboard/winback/send
 * Sends the Lulu email to the chosen wallets (looked up server-side, never
 * trusting client emails), personalised per person, in Resend batches of
 * 100. Skips people emailed in the last 3 days unless includeRecent.
 */
export async function POST(request: NextRequest) {
  const { session, error: authError } = await requirePlatformAdmin();
  if (authError) return authError;
  const admin = getSupabaseAdmin();
  if (!admin) return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  if (!process.env.RESEND_API_KEY?.trim()) {
    return NextResponse.json({ error: "RESEND_API_KEY is not configured on the server." }, { status: 503 });
  }

  const b = ((await request.json().catch(() => null)) ?? {}) as Body;
  const wallets = Array.isArray(b.wallets) ? [...new Set(b.wallets.filter((w): w is string => typeof w === "string").map((w) => w.toLowerCase()))] : [];
  const tpl = {
    subject: str(b.subject, 200),
    heading: str(b.heading, 200),
    body: str(b.body, 5000),
    cta: str(b.cta, 60) || "Open Delulu",
    ctaPath: str(b.ctaPath, 120) || "/home",
  };
  const templateId = str(b.templateId, 40) || null;
  const test = b.test === true;

  if (wallets.length === 0) return NextResponse.json({ error: "Pick at least one person." }, { status: 400 });
  if (wallets.length > MAX_RECIPIENTS) return NextResponse.json({ error: `At most ${MAX_RECIPIENTS} people per send.` }, { status: 400 });
  if (!tpl.subject || !tpl.body) return NextResponse.json({ error: "Subject and message are required." }, { status: 400 });
  if (!/^\/[A-Za-z0-9\-/?=&_]*$/.test(tpl.ctaPath)) return NextResponse.json({ error: "Button link must be an app path like /home." }, { status: 400 });
  const blanks = findBlanks(tpl.subject, tpl.heading, tpl.body, tpl.cta);
  if (blanks.length > 0) return NextResponse.json({ error: `Fill in ${blanks.join(", ")} before sending.` }, { status: 400 });

  const people = await loadOutreachPeople(admin, { fresh: true });
  const byWallet = new Map(people.map((p) => [p.wallet, p]));
  const chosen = wallets.map((w) => byWallet.get(w)).filter((p): p is OutreachPerson => Boolean(p));

  const appUrl = normalizeMarketingAppUrl(process.env.NEXT_PUBLIC_URL ?? "https://www.staydelulu.xyz");
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Lulu from Delulu <onboarding@resend.dev>";
  const resend = new Resend(process.env.RESEND_API_KEY);
  const render = (p: OutreachPerson) => {
    const v = mergeFor(p);
    const filled = {
      subject: fillTemplate(tpl.subject, v),
      heading: fillTemplate(tpl.heading || "Hey {name} 👋", v),
      body: fillTemplate(tpl.body, v),
      cta: fillTemplate(tpl.cta, v),
      ctaPath: tpl.ctaPath,
    };
    return {
      subject: filled.subject,
      html: buildLuluEmailHtml({ appUrl, ...filled }),
      text: buildLuluEmailText({ appUrl, ...filled }),
    };
  };

  if (test) {
    const sample = chosen[0];
    if (!sample) return NextResponse.json({ error: "Pick at least one person to preview with." }, { status: 400 });
    const r = render(sample);
    const { error } = await resend.emails.send({ from, to: session.email, subject: `[TEST] ${r.subject}`, html: r.html, text: r.text });
    if (error) return NextResponse.json({ error: error.message }, { status: 502 });
    return NextResponse.json({ ok: true, to: session.email });
  }

  const result: WinbackSendResult = { sent: 0, failed: 0, skippedNoEmail: 0, skippedRecent: 0, failures: [] };
  const recentCutoff = Date.now() - 3 * 86_400_000;
  const toSend = chosen.filter((p) => {
    if (!p.email) {
      result.skippedNoEmail++;
      return false;
    }
    if (b.includeRecent !== true && p.lastEmailedAt && new Date(p.lastEmailedAt).getTime() > recentCutoff) {
      result.skippedRecent++;
      return false;
    }
    return true;
  });
  result.skippedNoEmail += wallets.length - chosen.length;

  const logs: Record<string, unknown>[] = [];
  for (let i = 0; i < toSend.length; i += BATCH) {
    const batch = toSend.slice(i, i + BATCH);
    const payload = batch.map((p) => ({ from, to: p.email!, ...render(p) }));
    try {
      const { data, error } = await resend.batch.send(payload);
      if (error) throw new Error(error.message);
      const ids = (data?.data ?? []) as { id: string }[];
      batch.forEach((p, j) => {
        result.sent++;
        logs.push({ wallet: p.wallet, email: p.email, template_id: templateId, subject: payload[j].subject, resend_id: ids[j]?.id ?? null, status: "sent", sent_by: session.email });
      });
    } catch (err) {
      const reason = err instanceof Error ? err.message : "Send failed";
      for (const p of batch) {
        result.failed++;
        result.failures.push({ email: p.email!, reason });
        logs.push({ wallet: p.wallet, email: p.email, template_id: templateId, subject: tpl.subject, status: "failed", error: reason.slice(0, 300), sent_by: session.email });
      }
    }
    // Stay under Resend's request rate between batches.
    if (i + BATCH < toSend.length) await new Promise((r) => setTimeout(r, 600));
  }

  if (logs.length > 0) {
    const { error } = await admin.from("outreach_emails").insert(logs);
    if (error) console.error("[winback] could not log sends (run docs/migrations/20261117_outreach_emails.sql)", error.message);
  }
  invalidateOutreachCache();
  return NextResponse.json(result);
}

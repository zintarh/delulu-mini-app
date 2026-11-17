import { Resend } from "resend";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { sendPushAndNotification } from "@/lib/push/notify-recipients";
import { buildLuluEmailHtml, buildLuluEmailText } from "@/lib/outreach/email";
import { loadPeople, type Person } from "@/lib/nudges/people";
import { actedOn, isQuietHours, pickNudge, type Nudge, type NudgeRule } from "@/lib/nudges/rules";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

/** Who we look at: signed up, played a Bingo or posted a proof in the last 30 days. */
const WINDOW_DAYS = 30;
/** Deliverability: never blast — the rest go next run. */
const MAX_EMAILS_PER_RUN = 120;
const MAX_PUSH_PER_RUN = 600;
/** The platform's own wallets never get nudged. */
const INTERNAL_WALLETS = new Set(["0x9d8a7a866af0eee89b45abbb4f1bc9c3698b33e4"]);

export type NudgePlanItem = { wallet: string; username: string | null; rule: NudgeRule; channel: "push" | "email"; title: string };
export type NudgeRunResult = {
  dryRun: boolean;
  quietHours: boolean;
  people: number;
  planned: NudgePlanItem[];
  sent: number;
  failed: number;
  skippedCapped: number;
  actedMarked: number;
};

/** Lagos calendar day "YYYY-MM-DD" (UTC+1). */
const lagosDay = (ms: number) => new Date(ms + 3_600_000).toISOString().slice(0, 10);

export async function runNudges(admin: Admin, opts: { dryRun?: boolean; nowMs?: number; only?: string[] } = {}): Promise<NudgeRunResult> {
  const nowMs = opts.nowMs ?? Date.now();
  const since = new Date(nowMs - WINDOW_DAYS * 86_400_000).toISOString();
  let people = await loadPeople(admin, since, nowMs, { includeActive: true });
  people = people.filter((p) => !INTERNAL_WALLETS.has(p.wallet));
  if (opts.only?.length) people = people.filter((p) => opts.only!.includes(p.wallet));
  const byWallet = new Map(people.map((p) => [p.wallet, p]));

  // History: what's been sent (no repeats, one a day) — and mark what worked.
  const { data: log, error: logError } = await admin
    .from("nudge_log")
    .select("id, wallet, rule, dedupe_key, sent_at, acted_at, status")
    .gte("sent_at", since)
    .limit(20_000);
  // Without the log there's no memory of what was sent — never send blind (it would repeat every run).
  if (logError && !opts.dryRun) {
    throw new Error(`nudge_log unavailable (run docs/migrations/20261118_nudges.sql): ${logError.message}`);
  }
  const sentKeys = new Set((log ?? []).map((l) => `${l.wallet}|${l.rule}|${l.dedupe_key}`));
  const today = lagosDay(nowMs);
  const nudgedToday = new Set((log ?? []).filter((l) => l.status === "sent" && lagosDay(Date.parse(l.sent_at)) === today).map((l) => l.wallet));

  let actedMarked = 0;
  if (!opts.dryRun) {
    for (const l of log ?? []) {
      if (l.acted_at || l.status !== "sent" || nowMs - Date.parse(l.sent_at) > 2 * 86_400_000) continue;
      const p = byWallet.get(l.wallet);
      if (p && actedOn(l.rule as NudgeRule, p, l.sent_at)) {
        await admin.from("nudge_log").update({ acted_at: new Date(nowMs).toISOString() }).eq("id", l.id);
        actedMarked++;
      }
    }
  }

  const quietHours = isQuietHours(nowMs);
  const result: NudgeRunResult = { dryRun: !!opts.dryRun, quietHours, people: people.length, planned: [], sent: 0, failed: 0, skippedCapped: 0, actedMarked };
  if (quietHours && !opts.dryRun) return result;

  let emails = 0;
  let pushes = 0;
  const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Lulu from Delulu <onboarding@resend.dev>";
  const appUrl = process.env.NEXT_PUBLIC_URL || "https://www.staydelulu.xyz";

  for (const p of people) {
    if (nudgedToday.has(p.wallet)) continue; // one nudge a day, tops
    const n = pickNudge(p, nowMs);
    if (!n || sentKeys.has(`${p.wallet}|${n.rule}|${n.dedupeKey}`)) continue;
    const channel: "push" | "email" | null = p.pushOn ? "push" : p.email ? "email" : null;
    if (!channel) continue;
    if ((channel === "email" && emails >= MAX_EMAILS_PER_RUN) || (channel === "push" && pushes >= MAX_PUSH_PER_RUN)) {
      result.skippedCapped++;
      continue;
    }
    result.planned.push({ wallet: p.wallet, username: p.username, rule: n.rule, channel, title: n.title });
    if (opts.dryRun) continue;

    const ok = channel === "push" ? await sendPush(admin, p, n) : await sendEmail(resend, from, appUrl, p, n);
    if (channel === "push") pushes++;
    else emails++;
    if (ok) result.sent++;
    else result.failed++;
    await admin.from("nudge_log").upsert(
      { wallet: p.wallet, rule: n.rule, dedupe_key: n.dedupeKey, channel, status: ok ? "sent" : "failed", detail: n.title.slice(0, 200) },
      { onConflict: "wallet,rule,dedupe_key", ignoreDuplicates: true },
    );
  }
  return result;
}

async function sendPush(admin: Admin, p: Person, n: Nudge): Promise<boolean> {
  try {
    const r = await sendPushAndNotification({
      supabase: admin,
      recipientAddress: p.wallet,
      eventKey: `nudge:${n.rule}:${n.dedupeKey}:${p.wallet}`,
      title: n.title,
      body: n.body,
      url: n.path,
      type: "system", // an allowed notification type; the rule is in the event key
      message: `**${n.title}** ${n.body}`,
    });
    return r.sent || !r.skipped;
  } catch (err) {
    console.error(`[nudges] push ${n.rule} ${p.wallet} failed`, err);
    return false;
  }
}

async function sendEmail(resend: Resend | null, from: string, appUrl: string, p: Person, n: Nudge): Promise<boolean> {
  if (!resend || !p.email) return false;
  try {
    const { error } = await resend.emails.send({
      from,
      to: p.email,
      subject: n.emailSubject,
      html: buildLuluEmailHtml({ appUrl, subject: n.emailSubject, heading: n.emailHeading, body: n.emailBody, cta: n.cta, ctaPath: n.path }),
      text: buildLuluEmailText({ appUrl, heading: n.emailHeading, body: n.emailBody, cta: n.cta, ctaPath: n.path }),
    });
    if (error) throw error;
    return true;
  } catch (err) {
    console.error(`[nudges] email ${n.rule} ${p.wallet} failed`, err);
    return false;
  }
}

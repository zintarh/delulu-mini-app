import { Resend } from "resend";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { buildLuluEmailHtml, buildLuluEmailText } from "@/lib/outreach/email";
import { signupIdleEmail } from "@/lib/email/signup-idle";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const RULE = "signup_idle";
const SINCE = "2026-11-24T23:00:00.000Z";

function realEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (!email.includes("@") || email.endsWith("@wallet.local")) return null;
  return email;
}

/**
 * Emails people who signed up today (Lagos) and never started a card.
 * One send per wallet. Returns counts only.
 */
export async function sendSignupIdleEmails(admin: Admin): Promise<{ candidates: number; sent: number; failed: number; skippedAlreadySent: number }> {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  if (!resendKey) throw new Error("RESEND_API_KEY is not configured");
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Lulu from Delulu <onboarding@resend.dev>";
  const appUrl = process.env.NEXT_PUBLIC_URL || "https://www.staydelulu.xyz";
  const email = signupIdleEmail();

  const profiles: { address: string; email: string }[] = [];
  for (let fromRow = 0; ; fromRow += 500) {
    const { data, error } = await admin
      .from("profiles")
      .select("address, email")
      .gte("created_at", SINCE)
      .order("created_at", { ascending: true })
      .range(fromRow, fromRow + 499);
    if (error) throw new Error(error.message);
    const batch = data ?? [];
    for (const row of batch) {
      const mail = realEmail(row.email);
      if (mail) profiles.push({ address: String(row.address).toLowerCase(), email: mail });
    }
    if (batch.length < 500) break;
  }

  const started = new Set<string>();
  const wallets = profiles.map((p) => p.address);
  for (let i = 0; i < wallets.length; i += 150) {
    const slice = wallets.slice(i, i + 150);
    const [goals, cards] = await Promise.all([
      admin.from("forfeit_commitments").select("creator_wallet").in("creator_wallet", slice),
      admin.from("bingo_attempts").select("wallet").in("wallet", slice),
    ]);
    if (goals.error) throw new Error(goals.error.message);
    if (cards.error) throw new Error(cards.error.message);
    for (const row of goals.data ?? []) started.add(String(row.creator_wallet).toLowerCase());
    for (const row of cards.data ?? []) started.add(String(row.wallet).toLowerCase());
  }

  const byEmail = new Map<string, { address: string; email: string }>();
  for (const person of profiles) {
    if (!started.has(person.address) && !byEmail.has(person.email)) byEmail.set(person.email, person);
  }
  const idle = [...byEmail.values()];
  if (idle.length === 0) return { candidates: 0, sent: 0, failed: 0, skippedAlreadySent: 0 };
  const { data: prior, error: priorError } = await admin
    .from("nudge_log")
    .select("wallet")
    .eq("rule", RULE)
    .eq("status", "sent")
    .in("wallet", idle.map((p) => p.address).slice(0, 500));
  if (priorError) throw new Error(priorError.message);
  const already = new Set((prior ?? []).map((row) => String(row.wallet)));
  // The .in above is capped; page the rest if the idle list is longer.
  if (idle.length > 500) {
    for (let i = 500; i < idle.length; i += 500) {
      const { data, error } = await admin.from("nudge_log").select("wallet").eq("rule", RULE).eq("status", "sent").in("wallet", idle.slice(i, i + 500).map((p) => p.address));
      if (error) throw new Error(error.message);
      for (const row of data ?? []) already.add(String(row.wallet));
    }
  }

  const pending = idle.filter((p) => !already.has(p.address));
  const resend = new Resend(resendKey);
  let sent = 0;
  let failed = 0;
  const html = buildLuluEmailHtml({ appUrl, subject: email.subject, heading: email.heading, body: email.body, cta: email.cta, ctaPath: email.path });
  const text = buildLuluEmailText({ appUrl, heading: email.heading, body: email.body, cta: email.cta, ctaPath: email.path });

  for (let i = 0; i < pending.length; i += 50) {
    const batch = pending.slice(i, i + 50);
    const payload = batch.map((p) => ({ from, to: p.email, subject: email.subject, html, text }));
    let ok = false;
    try {
      const { error } = await resend.batch.send(payload);
      if (error) throw new Error(error.message);
      ok = true;
    } catch (err) {
      console.error("[signup-idle] batch failed", err instanceof Error ? err.message : "send failed");
    }
    if (ok) sent += batch.length;
    else failed += batch.length;
    await admin.from("nudge_log").upsert(
      batch.map((p) => ({
        wallet: p.address,
        rule: RULE,
        dedupe_key: "once",
        channel: "email",
        status: ok ? "sent" : "failed",
        detail: email.subject,
      })),
      { onConflict: "wallet,rule,dedupe_key" },
    );
    if (i + 50 < pending.length) await new Promise((resolve) => setTimeout(resolve, 700));
  }

  return { candidates: pending.length, sent, failed, skippedAlreadySent: idle.length - pending.length };
}

import { Resend } from "resend";
import type { getSupabaseAdmin } from "@/lib/push/supabase";
import { buildLuluEmailHtml, buildLuluEmailText } from "@/lib/outreach/email";
import { getEarnFacts } from "@/lib/earn/facts";
import { fmtMoney, type EarnFacts } from "@/lib/earn/format";
import { stakesBlock } from "@/lib/nudges/rules";
import { NAIRA_CASHOUT_MIN_G } from "@/lib/rewards/cash-out";

type Admin = NonNullable<ReturnType<typeof getSupabaseAdmin>>;

const k = (g: number) => g.toLocaleString("en-US");

/** The welcome email's words — pure, so it's tested without sending anything. */
export function firstWeekWelcomeEmail(p: { username: string | null; invitedBy: string | null }, facts: EarnFacts) {
  const fw = facts.firstWeek!;
  const amount = fmtMoney(fw.entry);
  const finish = Math.max(0, fw.entry.g - fw.perPhoto * 7);
  const hi = p.username ? `${p.username}, ` : "";
  const subject = p.invitedBy ? `@${p.invitedBy} invited you — your first week pays ${amount}` : `Welcome to Delulu — your first week pays ${amount}`;
  const body =
    (p.invitedBy ? `@${p.invitedBy} invited you to Delulu, and your first week is ready.\n\n` : "Welcome to Delulu — your first week is ready.\n\n") +
    `Show up 7 days in a row and you earn ${amount}. Here's how it pays:\n` +
    `📸 Every day you post one photo: +${k(fw.perPhoto)} G$, paid the same day\n` +
    `🏁 Finish all 7 days: +${k(finish)} G$ more, and your stake back\n\n` +
    `It takes a minute a day — between classes is enough. Everything you earn is yours to keep, and you can turn it into naira from ${k(NAIRA_CASHOUT_MIN_G)} G$ (How to earn → Turn G$ into naira).\n\n` +
    `Miss a day and the card ends (you lose your stake), but you keep what you've earned and can start again.\n\n` +
    `After your first week: stake more to earn more, and top players turn their points into cash on the monthly leaderboard.` +
    stakesBlock(facts, "firstWeek");
  return {
    subject,
    heading: `${hi}your first week pays ${amount}`,
    body,
    cta: "Start my first week",
    path: "/play",
  };
}

/**
 * Right after sign-up: "X invited you — your first week pays $1.59 (≈ ₦2,150)".
 * Once per wallet (logged in nudge_log, which also keeps the nudge engine from
 * emailing them again the same day). Sends nothing until First Week is live.
 * Never throws — sign-up must not fail over an email.
 */
export async function sendFirstWeekWelcome(admin: Admin, wallet: string): Promise<"sent" | "skipped" | "failed"> {
  try {
    const w = wallet.toLowerCase();
    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) return "skipped";

    const { data: already } = await admin.from("nudge_log").select("id").eq("wallet", w).eq("rule", "welcome").limit(1);
    if (already?.length) return "skipped";

    const { data: profile } = await admin.from("profiles").select("username, email, referred_by").eq("address", w).maybeSingle();
    const email = profile?.email && !String(profile.email).endsWith("@wallet.local") ? String(profile.email) : null;
    if (!email) return "skipped";

    const facts = await getEarnFacts(admin);
    if (!facts.firstWeek) return "skipped";

    let invitedBy: string | null = null;
    if (profile?.referred_by) {
      const { data: ref } = await admin.from("profiles").select("username").eq("address", String(profile.referred_by).toLowerCase()).maybeSingle();
      invitedBy = (ref?.username as string) ?? null;
    }

    const e = firstWeekWelcomeEmail({ username: (profile?.username as string) ?? null, invitedBy }, facts);
    const appUrl = process.env.NEXT_PUBLIC_URL || "https://www.staydelulu.xyz";
    const from = process.env.RESEND_FROM_EMAIL?.trim() || "Lulu from Delulu <onboarding@resend.dev>";
    const { error } = await new Resend(resendKey).emails.send({
      from,
      to: email,
      subject: e.subject,
      html: buildLuluEmailHtml({ appUrl, subject: e.subject, heading: e.heading, body: e.body, cta: e.cta, ctaPath: e.path }),
      text: buildLuluEmailText({ appUrl, heading: e.heading, body: e.body, cta: e.cta, ctaPath: e.path }),
    });
    const ok = !error;
    if (error) console.error("[welcome] send failed", error);
    await admin
      .from("nudge_log")
      .upsert(
        { wallet: w, rule: "welcome", dedupe_key: "once", channel: "email", status: ok ? "sent" : "failed", detail: e.subject.slice(0, 200) },
        { onConflict: "wallet,rule,dedupe_key", ignoreDuplicates: true },
      );
    return ok ? "sent" : "failed";
  } catch (err) {
    console.error("[welcome] failed", err);
    return "failed";
  }
}

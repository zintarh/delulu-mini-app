/**
 * Flow State vote ask: every face-verified player who hasn't voted for Delulu
 * yet gets one email + one push (and an in-app notification) pointing at the
 * one-tap vote page. The audience is worked out live from the chain: verified
 * (GoodDollar identity) and not already giving Delulu votes on the council.
 *
 * Usage (from apps/web):
 *   npx tsx --tsconfig tsconfig.json scripts/send-vote-ask.ts                   # dry run: audience + the message
 *   npx tsx --tsconfig tsconfig.json scripts/send-vote-ask.ts --test=you@x.com  # emails the sample to you
 *   npx tsx --tsconfig tsconfig.json scripts/send-vote-ask.ts --send            # real send (nudge_log dedupes)
 */
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });

const APP_URL = "https://www.staydelulu.xyz";
const RULE = "flow_vote_ask";
const DEDUPE = "gb-s5";

export const VOTE_ASK = {
  subject: "Delulu needs your vote 🗳️",
  heading: "Can you vote for Delulu?",
  body: [
    "Delulu is up for GoodBuilders funding on Flow State, and every vote helps keep the daily rewards flowing to you.",
    "You've done your face check, so you can vote. Open Delulu and tap Vote — it's free and takes a few seconds, right in the app.",
    "Thank you for being part of this. 💛\n— Lulu",
  ].join("\n\n"),
  cta: "Vote for Delulu",
  ctaPath: "/flow-state",
  pushTitle: "🗳️ Delulu needs your vote",
  pushBody: "Free, one tap in the app — your votes keep the rewards flowing.",
};

const arg = (name: string) => process.argv.find((a) => a.startsWith(`--${name}`))?.split("=")[1] ?? (process.argv.includes(`--${name}`) ? "1" : null);
const pause = () => new Promise((r) => setTimeout(r, 600));

async function main() {
  const { getSupabaseAdmin } = await import("@/lib/push/supabase");
  const { isLeaderboardBlacklisted } = await import("@/lib/constant");
  const { buildLuluEmailHtml, buildLuluEmailText } = await import("@/lib/outreach/email");
  const { sendPushAndNotification } = await import("@/lib/push/notify-recipients");
  const { FLOW_ABI, FLOW_COUNCIL, PROJECT_RECIPIENT, IDENTITY_ABI, IDENTITY_CONTRACT } = await import("@/lib/flow-state");
  const { createPublicClient, http } = await import("viem");
  const { celo } = await import("viem/chains");

  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase admin unavailable");
  const chain = createPublicClient({ chain: celo, transport: http("https://forno.celo.org") });

  const profiles: { address: string; username: string | null; email: string | null }[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await admin.from("profiles").select("address, username, email").range(from, from + 999);
    if (error) throw error;
    if (!data?.length) break;
    profiles.push(...data.map((p) => ({ address: String(p.address).toLowerCase(), username: (p.username as string | null) ?? null, email: (p.email as string | null) ?? null })));
    if (data.length < 1000) break;
  }
  const { data: alreadySent } = await admin.from("nudge_log").select("wallet").eq("rule", RULE).eq("dedupe_key", DEDUPE).eq("status", "sent");
  const sent = new Set((alreadySent ?? []).map((r) => String(r.wallet)));

  // Verified and not already backing Delulu.
  const candidates = profiles.filter((p) => /^0x[0-9a-f]{40}$/.test(p.address) && !isLeaderboardBlacklisted(p.address));
  const audience: typeof profiles = [];
  for (let i = 0; i < candidates.length; i += 40) {
    const batch = candidates.slice(i, i + 40);
    const checks = await Promise.all(
      batch.map(async (p) => {
        const a = p.address as `0x${string}`;
        const root = await chain.readContract({ address: IDENTITY_CONTRACT, abi: IDENTITY_ABI, functionName: "getWhitelistedRoot", args: [a] }).catch(() => null);
        if (!root || /^0x0{40}$/i.test(root)) return false;
        const votes = await chain.readContract({ address: FLOW_COUNCIL, abi: FLOW_ABI, functionName: "getVotes", args: [a] }).catch(() => null);
        if (!votes) return false; // can't tell — leave them out rather than ask someone who voted
        return !votes.some((v) => v.recipient.toLowerCase() === PROJECT_RECIPIENT && v.amount > 0n);
      }),
    );
    batch.forEach((p, k) => checks[k] && audience.push(p));
  }
  const todo = audience.filter((p) => !sent.has(p.address));
  const withEmail = todo.filter((p) => p.email && !p.email.endsWith("@wallet.local"));

  console.log(`Audience: ${audience.length} verified players not voting for Delulu · ${todo.length} not yet asked · ${withEmail.length} with a real email (everyone gets push + in-app).`);
  console.log(`\nSubject: ${VOTE_ASK.subject}\n\n${VOTE_ASK.heading}\n\n${VOTE_ASK.body}\n\n[${VOTE_ASK.cta}] → ${APP_URL}${VOTE_ASK.ctaPath}`);
  console.log(`\nPush: ${VOTE_ASK.pushTitle} — ${VOTE_ASK.pushBody}`);

  const html = buildLuluEmailHtml({ appUrl: APP_URL, subject: VOTE_ASK.subject, heading: VOTE_ASK.heading, body: VOTE_ASK.body, cta: VOTE_ASK.cta, ctaPath: VOTE_ASK.ctaPath });
  const text = buildLuluEmailText({ appUrl: APP_URL, heading: VOTE_ASK.heading, body: VOTE_ASK.body, cta: VOTE_ASK.cta, ctaPath: VOTE_ASK.ctaPath });
  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY!);
  const from = process.env.RESEND_FROM_EMAIL?.trim() || "Lulu from Delulu <onboarding@resend.dev>";

  const test = arg("test");
  if (test && test !== "1") {
    const { error } = await resend.emails.send({ from, to: test, subject: `[TEST] ${VOTE_ASK.subject}`, html, text });
    console.log(error ? `Test failed: ${error.message}` : `Test sent to ${test}.`);
    return;
  }
  if (!arg("send")) {
    console.log("\nDry run — pass --test=you@x.com for a sample, --send to send.");
    return;
  }

  let emails = 0;
  let pushes = 0;
  for (const p of todo) {
    let ok = false;
    if (p.email && !p.email.endsWith("@wallet.local")) {
      const { error } = await resend.emails.send({ from, to: p.email, subject: VOTE_ASK.subject, html, text });
      if (!error) {
        emails++;
        ok = true;
      }
      await pause();
    }
    try {
      await sendPushAndNotification({
        supabase: admin,
        recipientAddress: p.address,
        eventKey: `${RULE}:${DEDUPE}:${p.address}`,
        title: VOTE_ASK.pushTitle,
        body: VOTE_ASK.pushBody,
        url: VOTE_ASK.ctaPath,
        type: "system",
        message: `**${VOTE_ASK.pushTitle}** ${VOTE_ASK.pushBody}`,
      });
      pushes++;
      ok = true;
    } catch {
      /* push is best effort */
    }
    await admin.from("nudge_log").upsert(
      { wallet: p.address, rule: RULE, dedupe_key: DEDUPE, channel: "email+push", status: ok ? "sent" : "failed", detail: VOTE_ASK.subject },
      { onConflict: "wallet,rule,dedupe_key" },
    );
  }
  console.log(`Sent: ${emails} emails, ${pushes} push/in-app notifications to ${todo.length} players.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

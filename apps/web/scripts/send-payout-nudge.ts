/**
 * Month-end payout nudge: emails everyone in an active campaign with their
 * live monthly-leaderboard rank, how far they are from the top 10, and a
 * direct link to submit today's proof.
 *
 * Usage (from apps/web):
 *   pnpm tsx scripts/send-payout-nudge.ts                     # dry run — prints every email, sends nothing
 *   pnpm tsx scripts/send-payout-nudge.ts --test=you@x.com    # sends one sample of each variant to you
 *   pnpm tsx scripts/send-payout-nudge.ts --send              # sends to real users (skips anyone already sent)
 *
 * Real sends are logged to scripts/.payout-nudge-sent-<date>.json so a re-run
 * the same day never emails the same person twice.
 */
import { config } from "dotenv";
import { existsSync, readFileSync, writeFileSync } from "fs";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env.local") });
config({ path: resolve(process.cwd(), ".env") });

// ── Campaign facts (confirmed by the team) ────────────────────────────────
const PAYOUT_LABEL = "month end (Sep 30)";
const TOP_N = 10;
const LAST_ROUND = {
  totalG: 530_881,
  winners: 10,
  first: { name: "veenom33", amountG: 68_958 },
  tenthAmountG: 37_198,
};

// One log per day: a re-run the same day never double-sends, and each day's
// round reaches everyone again.
const SENT_LOG = resolve(
  process.cwd(),
  `scripts/.payout-nudge-sent-${new Date().toISOString().slice(0, 10)}.json`,
);

// NEXT_PUBLIC_URL in .env.local is often a dev tunnel — email links must point at production.
const APP_URL = (process.env.PAYOUT_NUDGE_APP_URL ?? "https://www.staydelulu.xyz").replace(/\/$/, "");

type Variant = "top10" | "chasing" | "unranked";

type Recipient = {
  address: string;
  email: string;
  username: string;
  variant: Variant;
  rank: number | null;
  points: number;
  gapToTop: number;
  proofsNeeded: number | null;
  pointsPerProof: number;
  campaignTitle: string;
  campaignUrl: string;
};

const fmt = (n: number) => n.toLocaleString("en-US");

function subjectFor(r: Recipient): string {
  switch (r.variant) {
    case "top10":
      return `You're #${r.rank}. Hold it and get paid at month end.`;
    case "chasing":
      return `${LAST_ROUND.first.name} made ${fmt(LAST_ROUND.first.amountG)} G$ on Delulu. You're #${r.rank}.`;
    case "unranked":
      return `${LAST_ROUND.first.name} made ${fmt(LAST_ROUND.first.amountG)} G$ on Delulu. Your turn.`;
  }
}

/** The one personalised line that changes per variant. */
function standingLine(r: Recipient): string {
  const proofs =
    r.proofsNeeded != null
      ? ` That's about <strong>${r.proofsNeeded} proof${r.proofsNeeded === 1 ? "" : "s"}</strong> at ${fmt(r.pointsPerProof)} pts each.`
      : "";
  switch (r.variant) {
    case "top10":
      return `You're <strong>#${r.rank}</strong> on this month's leaderboard with ${fmt(r.points)} pts. You're in the paid top ${TOP_N}, but only until someone passes you. Every day you skip, they catch up.`;
    case "chasing":
      return r.proofsNeeded != null
        ? `You're <strong>#${r.rank}</strong> with ${fmt(r.points)} pts, just <strong>${fmt(r.gapToTop)} pts</strong> from the paid top ${TOP_N}.${proofs}`
        : `You're <strong>#${r.rank}</strong> with ${fmt(r.points)} pts. Every proof moves you up the board, and the people above you are counting on you to skip today.`;
    case "unranked":
      return `You're not on this month's leaderboard yet. One proof gets you on it, and every proof after that climbs you toward the paid top ${TOP_N}.`;
  }
}

function emailHtml(r: Recipient, appUrl: string, escape: (s: string) => string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr><td align="center">
      <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;">
        <tr><td style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid #e5e7eb;">
          <img src="${appUrl}/favicon_io/android-chrome-192x192.png" alt="Delulu" width="48" height="48" style="border-radius:12px;display:block;margin:0 auto;" />
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="margin:0 0 20px;font-size:24px;font-weight:900;color:#111827;line-height:1.2;">Hey ${escape(r.username)} 👋</h1>

          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
            Last payout we paid <strong>${LAST_ROUND.winners} people ${fmt(LAST_ROUND.totalG)} G$</strong> just for showing up on their campaigns.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f9fafb;border-radius:12px;">
            <tr>
              <td style="padding:16px;text-align:center;width:50%;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">#1 · ${escape(LAST_ROUND.first.name)}</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#111827;">${fmt(LAST_ROUND.first.amountG)} G$</p>
              </td>
              <td style="padding:16px;text-align:center;width:50%;border-left:1px solid #e5e7eb;">
                <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;color:#9ca3af;">#10</p>
                <p style="margin:4px 0 0;font-size:22px;font-weight:900;color:#111827;">${fmt(LAST_ROUND.tenthAmountG)} G$</p>
              </td>
            </tr>
          </table>

          <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">${standingLine(r)}</p>

          <p style="margin:0 0 24px;font-size:15px;color:#374151;line-height:1.7;">
            Next payout: <strong>${PAYOUT_LABEL}</strong>, top ${TOP_N}. Your campaign <strong>${escape(r.campaignTitle)}</strong> is still running.
          </p>

          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
            <a href="${r.campaignUrl}" style="display:inline-block;background:#1a1a19;color:#ffffff;font-size:15px;font-weight:800;text-decoration:none;padding:14px 32px;border-radius:10px;">
              Submit today's proof →
            </a>
          </td></tr></table>
        </td></tr>
        <tr><td style="padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
          <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
            You're receiving this because you joined a campaign on <a href="${appUrl}" style="color:#6b7280;text-decoration:underline;">Delulu</a>.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function emailText(r: Recipient): string {
  const standing = standingLine(r).replace(/<[^>]+>/g, "");
  return [
    `Hey ${r.username},`,
    ``,
    `Last payout we paid ${LAST_ROUND.winners} people ${fmt(LAST_ROUND.totalG)} G$. #1 (${LAST_ROUND.first.name}) took home ${fmt(LAST_ROUND.first.amountG)} G$, #10 got ${fmt(LAST_ROUND.tenthAmountG)} G$.`,
    ``,
    standing,
    ``,
    `Next payout: ${PAYOUT_LABEL}, top ${TOP_N}. Your campaign "${r.campaignTitle}" is still running.`,
    ``,
    `Submit today's proof: ${r.campaignUrl}`,
    ``,
    `— The Delulu team`,
  ].join("\n");
}

async function buildRecipients(): Promise<Recipient[]> {
  const { getSupabaseAdmin } = await import("@/lib/push/supabase");
  const { getEffectiveDisplayEndsAt, isCampaignExpired, PARTICIPATING_STATUSES } = await import(
    "@/lib/community/campaign-types"
  );
  const { fetchMonthlyCampaignPointsFromGraph } = await import("@/lib/community/campaign-subgraph");
  const { monthlyCampaignLeaderboardSinceUnixSeconds, pointsPerMilestoneForJoinAmount } = await import(
    "@/lib/dashboard/campaign-constants"
  );
  const { isLeaderboardBlacklisted } = await import("@/lib/constant");

  const admin = getSupabaseAdmin();
  if (!admin) throw new Error("Supabase admin not configured");
  const appUrl = APP_URL;

  // Same ranking as /api/leaderboard/monthly-campaigns.
  const board = (await fetchMonthlyCampaignPointsFromGraph(monthlyCampaignLeaderboardSinceUnixSeconds()))
    .filter((row) => row.points_total > 0 && !isLeaderboardBlacklisted(row.wallet_address))
    .sort((a, b) => {
      const diff = b.points_total - a.points_total;
      if (diff !== 0) return diff;
      return (a.last_event_at ?? Infinity) - (b.last_event_at ?? Infinity);
    });
  const rankOf = new Map(board.map((row, i) => [row.wallet_address.toLowerCase(), i + 1]));
  const pointsOf = new Map(board.map((row) => [row.wallet_address.toLowerCase(), row.points_total]));
  const cutoffPoints = board[TOP_N - 1]?.points_total ?? 0;

  const { data: campaigns, error: campaignErr } = await admin
    .from("community_campaigns")
    .select("id, title, join_amount, is_free_to_join, display_ends_at, created_at, duration_days, communities(slug)")
    .in("status", [...PARTICIPATING_STATUSES]);
  if (campaignErr) throw campaignErr;
  const active = (campaigns ?? []).filter((c: any) => !isCampaignExpired(c));
  const campaignById = new Map(active.map((c: any) => [c.id, c]));

  const { data: participants, error: partErr } = await admin
    .from("campaign_participants")
    .select("campaign_id, wallet_address")
    .in("campaign_id", [...campaignById.keys()]);
  if (partErr) throw partErr;

  // One email per person — if they're in several campaigns, link the one
  // worth the most points per proof (the 1,000 G$ ones).
  const bestCampaign = new Map<string, any>();
  for (const p of participants ?? []) {
    const wallet = String(p.wallet_address).toLowerCase();
    const c = campaignById.get(p.campaign_id);
    const current = bestCampaign.get(wallet);
    const worth = (x: any) => pointsPerMilestoneForJoinAmount(x.is_free_to_join ? 0 : x.join_amount);
    if (!current || worth(c) > worth(current)) bestCampaign.set(wallet, c);
  }

  const { data: profiles, error: profErr } = await admin
    .from("profiles")
    .select("address, username, email")
    .in("address", [...bestCampaign.keys()]);
  if (profErr) throw profErr;

  const recipients: Recipient[] = [];
  for (const prof of profiles ?? []) {
    const email = prof.email as string | null;
    if (!email || !email.includes("@") || email.endsWith("@wallet.local")) continue;
    const address = String(prof.address).toLowerCase();
    if (isLeaderboardBlacklisted(address)) continue;

    const c = bestCampaign.get(address);
    const rank = rankOf.get(address) ?? null;
    const points = pointsOf.get(address) ?? 0;
    const pointsPerProof = pointsPerMilestoneForJoinAmount(c.is_free_to_join ? 0 : c.join_amount);
    const gapToTop = rank != null && rank > TOP_N ? Math.max(1, cutoffPoints - points + 1) : 0;
    const variant: Variant = rank == null ? "unranked" : rank <= TOP_N ? "top10" : "chasing";
    const slug = c.communities?.slug;
    // Daily proofs still possible before the campaign closes, today included.
    const endsAt = getEffectiveDisplayEndsAt(c);
    const proofDaysLeft = endsAt
      ? Math.max(0, Math.ceil((new Date(endsAt).getTime() - Date.now()) / 86_400_000))
      : Infinity;
    const proofsNeeded = variant === "chasing" ? Math.ceil(gapToTop / pointsPerProof) : null;

    recipients.push({
      address,
      email,
      username: (prof.username as string | null) ?? "there",
      variant,
      rank,
      points,
      gapToTop,
      // Only quote a proof count they can actually hit before the campaign ends.
      proofsNeeded: proofsNeeded != null && proofsNeeded <= proofDaysLeft ? proofsNeeded : null,
      pointsPerProof,
      campaignTitle: String(c.title).replace(/\s+/g, " ").trim(),
      campaignUrl: slug ? `${appUrl}/communities/${slug}/campaigns/${c.id}` : `${appUrl}/`,
    });
  }

  return recipients.sort((a, b) => (a.rank ?? Infinity) - (b.rank ?? Infinity));
}

async function main() {
  const args = process.argv.slice(2);
  const send = args.includes("--send");
  const testTo = args.find((a) => a.startsWith("--test="))?.slice("--test=".length);

  const { escapeMarketingHtml } = await import("@/lib/marketing-email-template");
  const appUrl = APP_URL;
  const recipients = await buildRecipients();

  console.log(`\n${recipients.length} recipients\n`);
  for (const r of recipients) {
    console.log(
      `${(r.rank != null ? `#${r.rank}` : "—").padStart(4)}  ${String(r.points).padStart(6)} pts  ${r.variant.padEnd(8)}  gap ${String(r.gapToTop).padStart(5)}  proofs ${String(r.proofsNeeded ?? "-").padStart(2)}  ${r.username.padEnd(16)}  ${r.campaignTitle}`,
    );
  }

  if (!send && !testTo) {
    const sample = recipients.find((r) => r.variant === "chasing") ?? recipients[0];
    if (sample) {
      console.log(`\n── Sample (${sample.variant}) ──\nSubject: ${subjectFor(sample)}\n\n${emailText(sample)}\n`);
    }
    console.log("Dry run — nothing sent. Use --test=<email> or --send.");
    return;
  }

  const { Resend } = await import("resend");
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM_EMAIL ?? "Delulu <onboarding@resend.dev>";

  if (testTo) {
    const samples = (["top10", "chasing", "unranked"] as Variant[])
      .map((v) => recipients.find((r) => r.variant === v))
      .filter((r): r is Recipient => Boolean(r));
    for (const r of samples) {
      const { error } = await resend.emails.send({
        from,
        to: testTo,
        subject: `[TEST ${r.variant}] ${subjectFor(r)}`,
        html: emailHtml(r, appUrl, escapeMarketingHtml),
        text: emailText(r),
      });
      console.log(error ? `✗ ${r.variant}: ${error.message}` : `✓ sent ${r.variant} sample (as ${r.username}) to ${testTo}`);
    }
    return;
  }

  const alreadySent = new Set<string>(existsSync(SENT_LOG) ? JSON.parse(readFileSync(SENT_LOG, "utf8")) : []);
  let sent = 0;
  let failed = 0;
  for (const r of recipients) {
    if (alreadySent.has(r.address)) continue;
    const { error } = await resend.emails.send({
      from,
      to: r.email,
      subject: subjectFor(r),
      html: emailHtml(r, appUrl, escapeMarketingHtml),
      text: emailText(r),
    });
    if (error) {
      failed++;
      console.error(`✗ ${r.username}: ${error.message}`);
      continue;
    }
    sent++;
    alreadySent.add(r.address);
    writeFileSync(SENT_LOG, JSON.stringify([...alreadySent], null, 2));
    // Stay under Resend's default rate limit.
    await new Promise((res) => setTimeout(res, 600));
  }
  console.log(`\nSent ${sent}, failed ${failed}, skipped ${recipients.length - sent - failed} (already sent).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

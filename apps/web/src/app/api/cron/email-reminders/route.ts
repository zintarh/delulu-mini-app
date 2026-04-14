import { NextRequest } from "next/server";
import { Resend } from "resend";
import { errorResponse, jsonResponse } from "@/lib/api";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getSubgraphUrlForChain, CELO_MAINNET_ID } from "@/lib/constant";
import {
  getDeluluCreatedAtMs,
  getMilestoneEndTimeMs,
  getMilestoneLabel,
} from "@/lib/milestone-utils";

type SubgraphMilestoneRow = {
  id: string;
  milestoneId: string;
  deadline: string;
  startTime: string | null;
  milestoneURI: string | null;
  isSubmitted: boolean;
  isVerified: boolean;
  delulu: {
    id: string;
    creatorAddress: string;
    createdAt: string;
    stakingDeadline: string;
    resolutionDeadline: string;
  };
};

function requireCronAuth(req: NextRequest) {
  const secret = process.env.PUSH_CRON_SECRET;
  if (!secret) return true;
  const header = req.headers.get("x-cron-secret");
  const qp = req.nextUrl.searchParams.get("secret");
  return header === secret || qp === secret;
}

async function fetchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Subgraph request failed: ${res.status}`);
  return res.json();
}

function toDateSeconds(s: string | null | undefined): Date | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000);
}

function makeEventKey({
  kind,
  deluluId,
  milestoneId,
  address,
  scheduledForSec,
}: {
  kind: string;
  deluluId: string;
  milestoneId?: string;
  address: string;
  scheduledForSec: number;
}) {
  return [kind, deluluId, milestoneId ?? "-", address.toLowerCase(), String(scheduledForSec)].join(":");
}

function buildMilestoneEmailHtml({
  username,
  milestoneLabel,
  deluluId,
  milestoneId,
  appUrl,
}: {
  username: string | null;
  milestoneLabel: string;
  deluluId: string;
  milestoneId: string;
  appUrl: string;
}) {
  const name = username || "Visionary";
  const milestoneUrl = `${appUrl}/delulu/${deluluId}?milestone=${milestoneId}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your milestone is expiring soon</title>
</head>
<body style="margin:0;padding:0;background-color:#0a0a0f;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#0a0a0f;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);border-radius:16px 16px 0 0;padding:40px 40px 32px;text-align:center;">
              <p style="margin:0 0 8px;font-size:13px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:rgba(255,255,255,0.7);">Stay Delulu</p>
              <h1 style="margin:0;font-size:28px;font-weight:800;color:#ffffff;line-height:1.2;">One hour left, ${name}.</h1>
              <p style="margin:12px 0 0;font-size:16px;color:rgba(255,255,255,0.85);line-height:1.5;">This is your moment. Don't let it slip by.</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#13131a;padding:36px 40px;">

              <!-- Milestone pill -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#1e1e2e;border:1px solid #2d2d44;border-radius:12px;padding:20px 24px;">
                    <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#7c3aed;">Milestone expiring</p>
                    <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">${milestoneLabel}</p>
                    <p style="margin:6px 0 0;font-size:13px;color:#f472b6;font-weight:600;">⏰ ~1 hour remaining</p>
                  </td>
                </tr>
              </table>

              <!-- Message -->
              <p style="margin:0 0 16px;font-size:16px;color:#c4c4d4;line-height:1.65;">
                You set this vision for yourself — and that already makes you extraordinary. The goal wasn't the easy path, it was the <em style="color:#e879f9;">right</em> one.
              </p>
              <p style="margin:0 0 16px;font-size:16px;color:#c4c4d4;line-height:1.65;">
                You have <strong style="color:#f472b6;">one hour</strong> to submit your proof and show the world (and yourself) that you actually did the thing. Whether it went perfectly or you learned a hard lesson — both count. Both are proof.
              </p>
              <p style="margin:0 0 28px;font-size:16px;color:#c4c4d4;line-height:1.65;">
                Don't let your milestone expire quietly. Go update it, submit your proof, and keep your streak alive. The version of you who set this goal is rooting for you. 🌙
              </p>

              <!-- CTA -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${milestoneUrl}" style="display:inline-block;background:linear-gradient(135deg,#7c3aed 0%,#db2777 100%);color:#ffffff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 36px;border-radius:50px;letter-spacing:0.5px;">
                      Submit Proof Now →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Motivational footer strip -->
          <tr>
            <td style="background:#1a0a2e;border-radius:0 0 16px 16px;padding:20px 40px;text-align:center;border-top:1px solid #2d2d44;">
              <p style="margin:0;font-size:13px;color:#7c3aed;font-weight:600;font-style:italic;">
                "Being delulu is the solulu." Keep going. 💜
              </p>
            </td>
          </tr>

          <!-- Unsubscribe / legal -->
          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4a4a6a;line-height:1.6;">
                You're receiving this because you set a milestone on <a href="${appUrl}" style="color:#7c3aed;text-decoration:none;">Stay Delulu</a>.<br/>
                This reminder was sent 1 hour before your milestone deadline.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export async function GET(req: NextRequest) {
  try {
    if (!requireCronAuth(req)) {
      return errorResponse("Unauthorized", 401);
    }

    const resendKey = process.env.RESEND_API_KEY;
    if (!resendKey) {
      return errorResponse("Missing RESEND_API_KEY.", 500);
    }

    const supabase = getSupabaseAdmin();
    if (!supabase) {
      return errorResponse("Missing Supabase credentials.", 500);
    }

    const subgraphUrl =
      getSubgraphUrlForChain(CELO_MAINNET_ID) || process.env.NEXT_PUBLIC_SUBGRAPH_URL;
    if (!subgraphUrl) {
      return errorResponse("Missing subgraph URL.", 500);
    }

    const appUrl = (process.env.NEXT_PUBLIC_URL || "https://staydelulu.xyz").replace(/\/$/, "");
    const resend = new Resend(resendKey);

    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    // 1 hour reminder, with jitter tolerance: [55m, 65m]
    const windowStartSec = nowSec + 55 * 60;
    const windowEndSec = nowSec + 65 * 60;

    const milestoneQuery = `
      query MilestonesForEmailReminders($from: BigInt!, $to: BigInt!) {
        milestones(
          first: 1000
          where: { deadline_gte: $from, deadline_lte: $to, isSubmitted: false, isVerified: false }
          orderBy: deadline
          orderDirection: asc
        ) {
          id
          milestoneId
          deadline
          startTime
          milestoneURI
          isSubmitted
          isVerified
          delulu {
            id
            creatorAddress
            createdAt
            stakingDeadline
            resolutionDeadline
          }
        }
      }
    `;

    // Broad server-side filter to catch chained milestone deadlines
    const from = String(nowSec - 60 * 60);
    const to = String(windowEndSec + 60 * 60);
    const milestoneResp = await fetchJson(subgraphUrl, {
      query: milestoneQuery,
      variables: { from, to },
    });

    const milestones: SubgraphMilestoneRow[] = milestoneResp?.data?.milestones ?? [];

    let sent = 0;
    let skipped = 0;

    for (const m of milestones) {
      const creatorAddress = (m.delulu?.creatorAddress || "").toLowerCase();
      if (!creatorAddress.startsWith("0x") || creatorAddress.length !== 42) {
        skipped++;
        continue;
      }

      const deluluCreatedAt =
        toDateSeconds(m.delulu.createdAt) ?? toDateSeconds(m.delulu.stakingDeadline);
      const createdAtMs = getDeluluCreatedAtMs(
        {
          createdAt: deluluCreatedAt ?? undefined,
          stakingDeadline: toDateSeconds(m.delulu.stakingDeadline) ?? undefined,
        },
        nowMs,
      );

      const endMs = getMilestoneEndTimeMs(
        {
          startTime: toDateSeconds(m.startTime),
          deadline: toDateSeconds(m.deadline) ?? new Date(0),
        },
        null,
        createdAtMs,
      );
      const endSec = Math.floor(endMs / 1000);

      if (endSec < windowStartSec || endSec > windowEndSec) {
        skipped++;
        continue;
      }

      const scheduledForSec = endSec - 60 * 60;
      const eventKey = makeEventKey({
        kind: "milestone_due_1h_email",
        deluluId: m.delulu.id,
        milestoneId: m.milestoneId,
        address: creatorAddress,
        scheduledForSec,
      });

      // Idempotency insert; skip if already sent
      const { error: insertErr } = await supabase.from("push_events_sent").insert({
        event_key: eventKey,
        address: creatorAddress,
      });
      if (insertErr) {
        skipped++;
        continue;
      }

      // Look up user email and username from profiles table
      const { data: profile, error: profileErr } = await supabase
        .from("profiles")
        .select("email, username")
        .eq("address", creatorAddress)
        .maybeSingle();

      if (profileErr || !profile?.email) {
        skipped++;
        continue;
      }

      const milestoneLabel = getMilestoneLabel(
        { milestoneId: m.milestoneId, milestoneURI: m.milestoneURI },
        80,
      );

      const html = buildMilestoneEmailHtml({
        username: (profile as any).username ?? null,
        milestoneLabel,
        deluluId: m.delulu.id,
        milestoneId: m.milestoneId,
        appUrl,
      });

      await resend.emails.send({
        from: "Stay Delulu <reminders@staydelulu.xyz>",
        to: (profile as any).email,
        subject: `⏰ 1 hour left on "${milestoneLabel}" — don't let it expire`,
        html,
      });
      sent++;
    }

    return jsonResponse({
      ok: true,
      nowSec,
      windowStartSec,
      windowEndSec,
      sent,
      skipped,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    return errorResponse(msg, 500);
  }
}

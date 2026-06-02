import { NextRequest } from "next/server";
import { errorResponse, jsonResponse } from "@/lib/api";
import { isCronAuthorized } from "@/lib/cron-auth";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { getSubgraphUrlForChain, CELO_MAINNET_ID } from "@/lib/constant";
import {
  getDeluluCreatedAtMs,
  getMilestoneEndTimeMs,
  getMilestoneLabel,
} from "@/lib/milestone-utils";
import { sendReminderEmail } from "@/lib/email/send-reminder";

export const maxDuration = 300;

// Temporary safety mode for production testing.
const TEST_RECIPIENT_EMAIL = "zintarh2024@gmail.com";
const TEST_MODE_ENABLED = false;
const MAX_TEST_EMAILS_PER_RUN = 1;

type SubgraphDeluluRow = {
  id: string;
  contentHash: string;
  createdAt: string;
  stakingDeadline: string;
  resolutionDeadline: string;
  isResolved: boolean;
  isCancelled: boolean;
  creatorAddress: string;
  milestones: {
    milestoneId: string;
    deadline: string;
    startTime: string | null;
    milestoneURI: string | null;
    isSubmitted: boolean;
    isVerified: boolean;
    isMissed?: boolean;
  }[];
};

type ProfileRow = { email: string | null; username: string | null };

type ReminderCandidate = {
  deluluId: string;
  contentHash: string;
  creatorAddress: string;
  milestoneId: string;
  milestoneURI: string | null;
  endSec: number;
};

async function fetchJson(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Subgraph request failed: ${res.status}`);
  const json = await res.json();
  if (json?.errors?.length) {
    throw new Error(json.errors[0]?.message ?? "Subgraph query error");
  }
  return json;
}

const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://cloudflare-ipfs.com/ipfs/",
];

async function resolveDeluluTitle(contentHash: string): Promise<string | null> {
  if (!contentHash) return null;
  for (const gateway of IPFS_GATEWAYS) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${gateway}${contentHash}`, {
        signal: controller.signal,
        cache: "no-store",
      });
      clearTimeout(timeoutId);
      if (!res.ok) continue;
      const data = await res.json();
      const title =
        (typeof data?.text === "string" ? data.text : "") ||
        (typeof data?.content === "string" ? data.content : "");
      if (title.trim()) return title.trim();
    } catch {
      continue;
    }
  }
  return null;
}

function toDateSeconds(s: string | null | undefined): Date | null {
  if (!s) return null;
  const n = Number(s);
  if (!Number.isFinite(n) || n <= 0) return null;
  return new Date(n * 1000);
}

function formatRemainingTime(nowSec: number, targetSec: number): string {
  const diff = targetSec - nowSec;
  if (diff <= 0) return "Ends now";
  const hours = Math.ceil(diff / 3600);
  if (hours <= 1) return "1 hour left";
  return `${hours} hours left`;
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
  milestoneId: string;
  address: string;
  scheduledForSec: number;
}) {
  return [kind, deluluId, milestoneId, address.toLowerCase(), String(scheduledForSec)].join(":");
}

function isValidEmail(email: string | null | undefined): email is string {
  if (!email) return false;
  if (email.endsWith("@wallet.local")) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function normalizeAddress(raw: string): string | null {
  const address = raw.toLowerCase();
  if (!address.startsWith("0x") || address.length !== 42) return null;
  return address;
}

/** Load profiles for many wallet addresses (stored lowercase in Supabase). */
async function fetchProfilesByAddress(
  supabase: NonNullable<ReturnType<typeof getSupabaseAdmin>>,
  addresses: string[],
): Promise<Map<string, ProfileRow>> {
  const map = new Map<string, ProfileRow>();
  if (addresses.length === 0) return map;

  const unique = [...new Set(addresses.map((a) => a.toLowerCase()))];
  const chunkSize = 100;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("profiles")
      .select("address, email, username")
      .in("address", chunk);

    if (error) {
      console.error("[email-reminders] profiles batch error:", error.message);
      continue;
    }

    for (const row of data ?? []) {
      const key = String((row as { address: string }).address).toLowerCase();
      map.set(key, {
        email: (row as { email?: string | null }).email ?? null,
        username: (row as { username?: string | null }).username ?? null,
      });
    }
  }

  return map;
}

function collectReminderCandidates(
  delulus: SubgraphDeluluRow[],
  nowMs: number,
  windowStartSec: number,
  windowEndSec: number,
): ReminderCandidate[] {
  const candidates: ReminderCandidate[] = [];

  for (const d of delulus) {
    const creatorAddress = normalizeAddress(d.creatorAddress || "");
    if (!creatorAddress) continue;

    const createdAtMs = getDeluluCreatedAtMs(
      {
        createdAt: toDateSeconds(d.createdAt) ?? undefined,
        stakingDeadline: toDateSeconds(d.stakingDeadline) ?? undefined,
      },
      nowMs,
    );

    let prevEndMs: number | null = null;
    const sortedMilestones = [...(d.milestones ?? [])].sort(
      (a, b) => Number(a.milestoneId) - Number(b.milestoneId),
    );

    for (const m of sortedMilestones) {
      if (m.isMissed) continue;

      const endMs = getMilestoneEndTimeMs(
        {
          startTime: toDateSeconds(m.startTime),
          deadline: toDateSeconds(m.deadline) ?? new Date(0),
        },
        prevEndMs,
        createdAtMs,
      );
      prevEndMs = endMs;
      const endSec = Math.floor(endMs / 1000);

      if (endSec <= windowStartSec || endSec > windowEndSec) continue;

      candidates.push({
        deluluId: d.id,
        contentHash: d.contentHash,
        creatorAddress,
        milestoneId: m.milestoneId,
        milestoneURI: m.milestoneURI,
        endSec,
      });
    }
  }

  return candidates;
}

export async function GET(req: NextRequest) {
  try {
    if (!isCronAuthorized(req)) {
      if (process.env.NODE_ENV === "development") {
        console.error("[email-reminders] Unauthorized — check CRON_SECRET matches Vercel.");
      }
      return errorResponse("Unauthorized", 401);
    }

    if (!process.env.RESEND_API_KEY) {
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

    const nowMs = Date.now();
    const nowSec = Math.floor(nowMs / 1000);
    // 30-minute cadence: remind milestones ending within the next hour.
    const windowStartSec = nowSec;
    const windowEndSec = nowSec + 60 * 60;

    const deluluQuery = `
      query DelulusForEmailReminders($now: BigInt!) {
        delulus(
          first: 300
          orderBy: createdAt
          orderDirection: desc
          where: { isResolved: false, isCancelled: false, resolutionDeadline_gt: $now }
        ) {
          id
          contentHash
          createdAt
          stakingDeadline
          resolutionDeadline
          isResolved
          isCancelled
          creatorAddress
          milestones(
            first: 30
            orderBy: milestoneId
            orderDirection: asc
            where: {
              isSubmitted: false
              isVerified: false
              isDeleted: false
              isMissed: false
            }
          ) {
            milestoneId
            deadline
            startTime
            milestoneURI
            isSubmitted
            isVerified
            isMissed
          }
        }
      }
    `;

    const deluluResp = await fetchJson(subgraphUrl, {
      query: deluluQuery,
      variables: { now: String(nowSec) },
    });

    const delulus: SubgraphDeluluRow[] = deluluResp?.data?.delulus ?? [];
    const candidates = collectReminderCandidates(
      delulus,
      nowMs,
      windowStartSec,
      windowEndSec,
    );

    const profilesByAddress = await fetchProfilesByAddress(
      supabase,
      candidates.map((c) => c.creatorAddress),
    );

    const titleByDeluluId = new Map<string, string>();

    let sent = 0;
    let skipped = 0;
    let sendErrors = 0;
    let noEmail = 0;
    let alreadySent = 0;
    let idempotencyErrors = 0;

    for (const c of candidates) {
      const profile = profilesByAddress.get(c.creatorAddress);
      const recipientEmail = TEST_MODE_ENABLED
        ? TEST_RECIPIENT_EMAIL
        : profile?.email;

      if (!TEST_MODE_ENABLED && !isValidEmail(recipientEmail)) {
        noEmail++;
        skipped++;
        continue;
      }

      const scheduledForSec = c.endSec - 60 * 60;
      const eventKey = makeEventKey({
        kind: "milestone_due_1h_email",
        deluluId: c.deluluId,
        milestoneId: c.milestoneId,
        address: c.creatorAddress,
        scheduledForSec,
      });

      const { error: insertErr } = await supabase.from("push_events_sent").insert({
        event_key: eventKey,
        address: c.creatorAddress,
      });

      if (insertErr) {
        if (insertErr.code === "23505") {
          alreadySent++;
          skipped++;
          continue;
        }
        idempotencyErrors++;
        skipped++;
        console.error("[email-reminders] push_events_sent insert error:", {
          code: insertErr.code,
          message: insertErr.message,
          deluluId: c.deluluId,
          milestoneId: c.milestoneId,
        });
        continue;
      }

      let deluluTitle = titleByDeluluId.get(c.deluluId);
      if (deluluTitle === undefined) {
        deluluTitle =
          (await resolveDeluluTitle(c.contentHash)) ?? "Your ongoing delulu";
        titleByDeluluId.set(c.deluluId, deluluTitle);
      }

      const milestoneLabel = getMilestoneLabel(
        { milestoneId: c.milestoneId, milestoneURI: c.milestoneURI },
        80,
      );
      const milestoneUrl = `${appUrl}/delulu/${c.deluluId}?milestone=${c.milestoneId}`;

      try {
        await sendReminderEmail(
          recipientEmail as string,
          {
            username: profile?.username ?? "Visionary",
            goalTitle: "A milestone on your ongoing delulu is due in about 1 hour",
            pendingHabits: [
              {
                emoji: "",
                title: deluluTitle,
                milestoneTitle: milestoneLabel,
                timeLeftText: formatRemainingTime(nowSec, c.endSec),
                ctaUrl: milestoneUrl,
                ctaLabel: "Submit proof",
              },
            ],
            appUrl,
            ctaUrl: milestoneUrl,
            ctaLabel: "Submit proof",
            manageUrl: `${appUrl}/profile`,
          },
          {
            subject: `Zinta from Delulu: ${milestoneLabel} is due soon on "${deluluTitle}"`,
          },
        );
        sent++;
      } catch (sendErr: unknown) {
        sendErrors++;
        skipped++;
        await supabase.from("push_events_sent").delete().eq("event_key", eventKey);
        console.error("[email-reminders] send failed:", {
          address: c.creatorAddress,
          recipientEmail,
          deluluId: c.deluluId,
          milestoneId: c.milestoneId,
          message: sendErr instanceof Error ? sendErr.message : String(sendErr),
        });
        continue;
      }

      if (TEST_MODE_ENABLED && sent >= MAX_TEST_EMAILS_PER_RUN) {
        break;
      }
    }

    return jsonResponse({
      ok: true,
      nowSec,
      windowStartSec,
      windowEndSec,
      activeDelulus: delulus.length,
      milestonesInWindow: candidates.length,
      sent,
      skipped,
      skippedBreakdown: {
        noEmail,
        alreadySent,
        idempotencyErrors,
        other: Math.max(0, skipped - noEmail - alreadySent - idempotencyErrors),
      },
      sendErrors,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Cron failed";
    console.error("[email-reminders] fatal:", msg);
    return errorResponse(msg, 500);
  }
}

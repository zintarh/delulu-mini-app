import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import {
  buildMarketingEmailDocumentHtml,
  buildMarketingEmailText,
  normalizeMarketingAppUrl,
} from "@/lib/marketing-email-template";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

// GET: return all users with real email addresses (no pagination)
export async function GET() {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("address, username, email, pfp_url, created_at")
    .order("created_at", { ascending: false })
    .limit(2000);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const users = (data ?? []).filter(
    (u) => u.email && !u.email.endsWith("@wallet.local") && u.email.includes("@"),
  );

  return NextResponse.json({ users, total: users.length });
}

// POST: send email to a list of email addresses
export async function POST(request: NextRequest) {
  let body: { emails: string[]; subject: string; message: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { emails, subject, message } = body;

  if (!Array.isArray(emails) || emails.length === 0) {
    return NextResponse.json({ error: "emails must be a non-empty array" }, { status: 400 });
  }
  if (!subject?.trim()) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const appUrl = normalizeMarketingAppUrl(process.env.NEXT_PUBLIC_URL ?? "https://delulu.app");
  const from =
    process.env.RESEND_FROM_EMAIL?.trim() ||
    "Zinta from Dululu <onboarding@resend.dev>";
  if (!process.env.RESEND_API_KEY?.trim()) {
    return NextResponse.json(
      { error: "RESEND_API_KEY is not configured on the server." },
      { status: 503 },
    );
  }

  // Look up profiles for username personalisation
  const normalised = emails.map((e) => e.toLowerCase());
  const { data: profiles } = await supabase
    .from("profiles")
    .select("email, username")
    .in("email", normalised);

  const profileMap = new Map<string, string>();
  for (const p of profiles ?? []) {
    if (p.email) profileMap.set((p.email as string).toLowerCase(), (p.username as string | null) ?? "there");
  }

  let sent = 0;
  let skipped = 0;
  const failed: string[] = [];
  const failedDetails: Array<{ email: string; reason: string }> = [];

  for (const email of emails) {
    if (!email || !email.includes("@") || email.endsWith("@wallet.local")) {
      skipped++;
      continue;
    }

    const username = profileMap.get(email.toLowerCase()) ?? "there";

    try {
      const { error: sendError } = await resend.emails.send({
        from,
        to: email,
        subject: subject.trim(),
        html: buildMarketingEmailDocumentHtml({
          appUrl,
          subject: subject.trim(),
          messagePlain: message.trim(),
          username,
        }),
        text: buildMarketingEmailText({
          username,
          subject: subject.trim(),
          message: message.trim(),
          appUrl,
        }),
      });

      if (sendError) throw new Error(sendError.message);
      sent++;
    } catch (err) {
      console.error(`[send-email] failed for ${email}:`, err);
      failed.push(email);
      const reason =
        err instanceof Error && err.message
          ? err.message
          : "Unknown send error";
      failedDetails.push({ email, reason });
    }
  }

  return NextResponse.json({
    sent,
    skipped,
    failed: failed.length,
    total: emails.length,
    failedDetails,
  });
}

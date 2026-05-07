import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/push/supabase";
import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

interface BroadcastBody {
  addresses: string[];
  subject: string;
  message: string;
  appUrl?: string;
}

function broadcastEmailHtml({
  username,
  message,
  deluluUrl,
  appUrl,
  subject,
}: {
  username: string;
  message: string;
  deluluUrl: string;
  appUrl: string;
  subject: string;
}): string {
  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width:600px;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #e5e7eb;">

          <!-- Header -->
          <tr>
            <td style="padding:28px 32px 20px;text-align:center;border-bottom:1px solid #e5e7eb;">
              <img src="${appUrl}/favicon_io/android-chrome-192x192.png" alt="Delulu" width="48" height="48"
                style="border-radius:12px;display:block;margin:0 auto 10px;" />
              <p style="margin:0;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:#9ca3af;">
                From the Delulu team
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <h1 style="margin:0 0 8px;font-size:24px;font-weight:900;color:#111827;line-height:1.2;">
                Hey ${username} 👋
              </h1>
              <div style="margin:20px 0;font-size:15px;color:#374151;line-height:1.75;">
                ${safeMessage}
              </div>

              <!-- Divider -->
              <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${deluluUrl}"
                      style="display:inline-block;background:#111111;color:#ffffff;font-size:14px;font-weight:800;
                             text-decoration:none;padding:14px 32px;border-radius:10px;letter-spacing:0.3px;">
                      Set your milestone →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px 32px;border-top:1px solid #e5e7eb;text-align:center;">
              <p style="margin:0;font-size:12px;color:#9ca3af;line-height:1.5;">
                You're receiving this because you have an active delulu on
                <a href="${appUrl}" style="color:#6b7280;text-decoration:underline;">delulu.app</a>.
              </p>
              <p style="margin:6px 0 0;font-size:12px;color:#9ca3af;">
                <a href="${appUrl}/profile" style="color:#6b7280;text-decoration:underline;">Manage notifications</a>
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

function broadcastEmailText({
  username,
  message,
  deluluUrl,
}: {
  username: string;
  message: string;
  deluluUrl: string;
}): string {
  return `Hey ${username},\n\n${message}\n\nSet your milestone: ${deluluUrl}\n\n— The Delulu team`;
}

export async function POST(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  let body: BroadcastBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { addresses, subject, message } = body;

  if (!Array.isArray(addresses) || addresses.length === 0) {
    return NextResponse.json({ error: "addresses must be a non-empty array" }, { status: 400 });
  }
  if (!subject?.trim()) {
    return NextResponse.json({ error: "subject is required" }, { status: 400 });
  }
  if (!message?.trim()) {
    return NextResponse.json({ error: "message is required" }, { status: 400 });
  }

  const appUrl = process.env.NEXT_PUBLIC_URL ?? "https://delulu.app";
  const from = process.env.RESEND_FROM_EMAIL ?? "Zinta from Delulu <onboarding@resend.dev>";

  // Fetch profiles for all provided addresses
  const normalised = addresses.map((a) => a.toLowerCase());
  const { data: profiles, error: dbError } = await supabase
    .from("profiles")
    .select("address, username, email")
    .in("address", normalised);

  if (dbError) {
    return NextResponse.json({ error: dbError.message }, { status: 500 });
  }

  let sent = 0;
  let skipped = 0;
  const failed: string[] = [];

  for (const profile of profiles ?? []) {
    const email = profile.email as string | null;

    // Skip wallet placeholder emails or missing
    if (!email || email.endsWith("@wallet.local") || !email.includes("@")) {
      skipped++;
      continue;
    }

    const username = (profile.username as string | null) ?? "there";
    const deluluUrl = `${appUrl}/profile`;

    try {
      const { error: sendError } = await resend.emails.send({
        from,
        to: email,
        subject: subject.trim(),
        html: broadcastEmailHtml({ username, message, deluluUrl, appUrl, subject }),
        text: broadcastEmailText({ username, message, deluluUrl }),
      });

      if (sendError) throw new Error(sendError.message);
      sent++;
    } catch (err) {
      console.error(`[broadcast] failed for ${email}:`, err);
      failed.push(email);
    }
  }

  return NextResponse.json({ sent, skipped, failed: failed.length, total: addresses.length });
}

// GET: dry-run — returns how many addresses have real emails (no sends)
export async function GET(request: NextRequest) {
  const supabase = getSupabaseAdmin();
  if (!supabase) {
    return NextResponse.json({ error: "Database not configured" }, { status: 503 });
  }

  const addresses = (request.nextUrl.searchParams.get("addresses") ?? "")
    .split(",")
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean);

  if (addresses.length === 0) {
    return NextResponse.json({ reachable: 0, total: 0 });
  }

  const { data: profiles } = await supabase
    .from("profiles")
    .select("address, email")
    .in("address", addresses);

  const reachable = (profiles ?? []).filter(
    (p) => p.email && !p.email.endsWith("@wallet.local") && p.email.includes("@"),
  ).length;

  return NextResponse.json({ reachable, total: addresses.length });
}

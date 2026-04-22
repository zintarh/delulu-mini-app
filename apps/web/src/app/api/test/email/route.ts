import { NextRequest } from "next/server";
import { Resend } from "resend";
import { jsonResponse, errorResponse } from "@/lib/api";

/**
 * Test endpoint — sends a sample milestone reminder email to any address.
 *
 * Usage (dev only, guarded by PUSH_CRON_SECRET):
 *   GET /api/test/email?to=you@example.com&secret=YOUR_CRON_SECRET
 *
 * Optional params:
 *   name=YourName        (default: "Visionary")
 *   milestone=Some%20goal (default: "Milestone #1")
 */
export async function GET(req: NextRequest) {
  // Lightweight smoke-test endpoint for Resend delivery checks.
  // Auth: require cron secret so this can't be abused in prod
  const secret = process.env.PUSH_CRON_SECRET;
  const provided = req.nextUrl.searchParams.get("secret") || req.headers.get("x-cron-secret");
  if (secret && provided !== secret) {
    return errorResponse("Unauthorized", 401);
  }

  const to = req.nextUrl.searchParams.get("to");
  if (!to) return errorResponse("Missing ?to=email param", 400);

  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return errorResponse("RESEND_API_KEY not set in env", 500);

  const name = req.nextUrl.searchParams.get("name") || "Visionary";
  const milestone = req.nextUrl.searchParams.get("milestone") || "Milestone #1 — test";
  const appUrl = (process.env.NEXT_PUBLIC_URL || "https://staydelulu.xyz").replace(/\/$/, "");
  const milestoneUrl = `${appUrl}/delulu/test?milestone=1`;

  const html = `<!DOCTYPE html>
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
                    <p style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">${milestone}</p>
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

          <!-- Label -->
          <tr>
            <td style="padding:20px 40px;text-align:center;">
              <p style="margin:0;font-size:11px;color:#4a4a6a;line-height:1.6;">
                ⚠️ This is a <strong style="color:#7c3aed;">test email</strong> sent from <a href="${appUrl}" style="color:#7c3aed;text-decoration:none;">Stay Delulu</a>.<br/>
                Real reminders are sent 1 hour before a milestone deadline.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  const resend = new Resend(resendKey);
  const { data, error } = await resend.emails.send({
    from: "Stay Delulu <reminders@staydelulu.xyz>",
    to,
    subject: `⏰ [TEST] 1 hour left on "${milestone}" — don't let it expire`,
    html,
  });

  if (error) {
    console.error("[test-email] Resend error:", error);
    return errorResponse(`Resend error: ${JSON.stringify(error)}`, 500);
  }

  return jsonResponse({ ok: true, emailId: data?.id, sentTo: to });
}

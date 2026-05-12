/**
 * Shared HTML for admin marketing emails — must match admin preview and Resend payload.
 */

export function normalizeMarketingAppUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "https://delulu.app";
  if (t.startsWith("http://") || t.startsWith("https://")) return t.replace(/\/$/, "");
  return `https://${t.replace(/\/$/, "")}`;
}

export function escapeMarketingHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function marketingMessageToHtml(message: string): string {
  return escapeMarketingHtml(message).replace(/\n/g, "<br />");
}

/** Inner `<table>…</table>` — same markup for browser preview and email clients. */
export function buildMarketingEmailInnerHtml(params: {
  appUrl: string;
  subject: string;
  messagePlain: string;
  username: string;
}): string {
  const appUrl = normalizeMarketingAppUrl(params.appUrl);
  const logoUrl = `${appUrl}/favicon_io/android-chrome-192x192.png`;
  const safeSubject = escapeMarketingHtml(params.subject.trim());
  const safeUsername = escapeMarketingHtml(params.username.trim() || "there");
  const bodyHtml =
    params.messagePlain.trim() === ""
      ? `<span style="color:#999;font-style:italic;">Your message will appear here.</span>`
      : marketingMessageToHtml(params.messagePlain.trim());

  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:32px 16px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:separate;border-spacing:0;background-color:#ffffff;border-radius:8px;overflow:hidden;">
        <tr>
          <td style="padding:32px 40px 24px;border-bottom:1px solid #f0f0f0;background-color:#ffffff;">
            <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td valign="middle" style="width:40px;">
                  <img src="${logoUrl}" alt="Delulu" width="40" height="40" border="0"
                    style="display:block;border-radius:8px;border:0;outline:none;text-decoration:none;" />
                </td>
                <td valign="middle" style="padding-left:12px;">
                  <p style="margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;color:#000000;">Delulu</p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;background-color:#ffffff;">
            <h1 style="margin:0 0 16px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:22px;font-weight:600;line-height:1.4;color:#000000;letter-spacing:-0.5px;">${safeSubject || "—"}</h1>
            <p style="margin:0 0 20px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#333333;">Hello, ${safeUsername}</p>
            <div style="font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:15px;line-height:1.6;color:#666666;margin-bottom:28px;">
              ${bodyHtml}
            </div>
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-bottom:0;">
              <tr>
                <td style="border-radius:6px;background-color:#000000;">
                  <a href="${appUrl}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:12px 24px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;border-radius:6px;">Open Delulu</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:24px 40px;border-top:1px solid #f0f0f0;background-color:#fafafa;">
            <p style="margin:0 0 12px;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#999999;line-height:1.5;">
              You received this email because you have a Delulu account.
            </p>
            <p style="margin:0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:13px;color:#999999;line-height:1.5;">
              <a href="${appUrl}/settings" style="color:#666666;text-decoration:none;border-bottom:1px solid #dddddd;">Update preferences</a>
              &nbsp;·&nbsp;
              <a href="${appUrl}/profile" style="color:#666666;text-decoration:none;border-bottom:1px solid #dddddd;">Unsubscribe</a>
            </p>
            <p style="margin:16px 0 0;font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:12px;color:#bbbbbb;">© ${new Date().getFullYear()} Delulu. All rights reserved.</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>`;
}

export function buildMarketingEmailDocumentHtml(params: {
  appUrl: string;
  subject: string;
  messagePlain: string;
  username: string;
}): string {
  const inner = buildMarketingEmailInnerHtml(params);
  const safeTitle = escapeMarketingHtml(params.subject.trim() || "Delulu");
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>${safeTitle}</title>
</head>
<body style="margin:0;padding:0;background-color:#f5f5f5;">
  ${inner}
</body>
</html>`;
}

export function buildMarketingEmailText(params: {
  username: string;
  subject: string;
  message: string;
  appUrl: string;
}): string {
  const appUrl = normalizeMarketingAppUrl(params.appUrl);
  const name = params.username.trim() || "there";
  return `${params.subject.trim()}\n\nHello, ${name}\n\n${params.message.trim()}\n\nOpen Delulu: ${appUrl}\n\nUpdate preferences: ${appUrl}/settings`;
}

import { escapeMarketingHtml, normalizeMarketingAppUrl } from "@/lib/marketing-email-template";

/**
 * Lulu-styled email: cream page, white card with an ink outline, Lulu on top,
 * a chunky yellow button — the app's look, built from tables and inline
 * styles so Gmail, Outlook and Apple Mail all render it.
 */
export function buildLuluEmailHtml(p: {
  appUrl: string;
  subject: string;
  heading: string;
  body: string;
  cta: string;
  ctaPath: string;
}): string {
  const appUrl = normalizeMarketingAppUrl(p.appUrl);
  const href = `${appUrl}${p.ctaPath.startsWith("/") ? p.ctaPath : `/${p.ctaPath}`}`;
  const lulu = `${appUrl}/favicon_io/android-chrome-192x192.png`;
  const font = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const paragraphs = p.body
    .trim()
    .split(/\n{2,}/)
    .map(
      (para) =>
        `<p style="margin:0 0 16px;font-family:${font};font-size:16px;line-height:1.6;color:#3a3a37;">${escapeMarketingHtml(para.trim()).replace(/\n/g, "<br />")}</p>`,
    )
    .join("");
  const preheader = escapeMarketingHtml(p.body.replace(/\s+/g, " ").trim().slice(0, 110));

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<title>${escapeMarketingHtml(p.subject)}</title>
</head>
<body style="margin:0;padding:0;background-color:#fdf1c7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${preheader}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#fdf1c7;padding:28px 14px;">
  <tr>
    <td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
        <tr>
          <td align="center" style="padding:0 0 4px;">
            <img src="${lulu}" alt="Lulu" width="88" height="88" style="display:block;border:0;outline:none;" />
          </td>
        </tr>
        <tr>
          <td style="background-color:#ffffff;border:2px solid #161615;border-radius:24px;padding:32px 30px 30px;">
            <h1 style="margin:0 0 18px;font-family:${font};font-size:26px;line-height:1.25;font-weight:800;color:#161615;">${escapeMarketingHtml(p.heading)}</h1>
            ${paragraphs}
            <table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:10px;">
              <tr>
                <td style="background-color:#f6c324;border:2px solid #161615;border-radius:14px;">
                  <a href="${href}" target="_blank" rel="noopener noreferrer" style="display:inline-block;padding:14px 26px;font-family:${font};font-size:16px;font-weight:800;color:#161615;text-decoration:none;">${escapeMarketingHtml(p.cta)} &rarr;</a>
                </td>
              </tr>
            </table>
            <p style="margin:26px 0 0;font-family:${font};font-size:15px;line-height:1.5;color:#3a3a37;">Stay delulu,<br /><strong style="color:#161615;">Lulu</strong> 💛</p>
          </td>
        </tr>
        <tr>
          <td align="center" style="padding:20px 10px 0;font-family:${font};font-size:12px;line-height:1.6;color:#6b6b65;">
            You're getting this because you have a Delulu account.<br />
            <a href="${appUrl}/settings" style="color:#6b6b65;">Email preferences</a> &middot; <a href="${appUrl}" style="color:#6b6b65;">staydelulu.xyz</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>`;
}

export function buildLuluEmailText(p: { appUrl: string; heading: string; body: string; cta: string; ctaPath: string }): string {
  const appUrl = normalizeMarketingAppUrl(p.appUrl);
  return `${p.heading}\n\n${p.body.trim()}\n\n${p.cta}: ${appUrl}${p.ctaPath}\n\nStay delulu,\nLulu\n\nEmail preferences: ${appUrl}/settings`;
}

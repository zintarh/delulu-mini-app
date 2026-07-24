import { escapeMarketingHtml } from "@/lib/marketing-email-template";

export type RewardNotificationEmailData = {
  username: string;
  amountLabel: string;
  tokenSymbol: string;
  appUrl: string;
  claimUrl: string;
  reason?: string;
};

export function rewardNotificationEmailHtml(data: RewardNotificationEmailData): string {
  const safeUsername = escapeMarketingHtml(data.username);
  const safeAmount = escapeMarketingHtml(data.amountLabel);
  const safeSymbol = escapeMarketingHtml(data.tokenSymbol);
  const safeReason = data.reason ? escapeMarketingHtml(data.reason) : null;
  const appUrl = data.appUrl.replace(/\/$/, "");
  const rewardsUrl = data.claimUrl;

  const reasonBlock = safeReason
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0"
        style="background-color: #f9fafb; border-radius: 12px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
        <tr>
          <td style="padding: 16px 18px;">
            <p style="margin: 0 0 4px; font-size: 11px; font-weight: 700; letter-spacing: 1.2px; text-transform: uppercase; color: #6b7280;">
              Note from the team
            </p>
            <p style="margin: 0; font-size: 15px; font-weight: 600; color: #111827; line-height: 1.5;">
              ${safeReason}
            </p>
          </td>
        </tr>
      </table>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your Delulu reward is ready</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 560px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e5e7eb;">

          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="${appUrl}/favicon_io/android-chrome-192x192.png" alt="Delulu" width="52" height="52"
                style="border-radius: 14px; display: block; margin: 0 auto 12px;" />
            </td>
          </tr>

          <tr>
            <td style="padding: 32px;">
              <h1 style="margin: 0 0 8px; font-size: 24px; font-weight: 900; color: #111827; line-height: 1.25;">
                Hi ${safeUsername},
              </h1>
              <h2 style="margin: 0 0 16px; font-size: 20px; font-weight: 800; color: #111827; line-height: 1.3;">
                Your Delulu reward is ready
              </h2>

              <p style="margin: 0 0 24px; font-size: 15px; color: #374151; line-height: 1.7;">
                The Delulu team added a reward to your account. You can review it anytime on your Rewards page.
              </p>

              ${reasonBlock}

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background-color: #fffbeb; border-radius: 16px; border: 1px solid #fde68a; margin-bottom: 28px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 6px; font-size: 11px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #92400e;">
                      Amount
                    </p>
                    <p style="margin: 0; font-size: 32px; font-weight: 900; color: #111827; line-height: 1.2;">
                      ${safeAmount}
                      <span style="font-size: 18px; font-weight: 700; color: #6b7280;">${safeSymbol}</span>
                    </p>
                  </td>
                </tr>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${rewardsUrl}"
                      target="_blank"
                      rel="noopener noreferrer"
                      style="display: inline-block; background-color: #f6c324; color: #1a1a19; font-size: 14px; font-weight: 900;
                        text-decoration: none; padding: 14px 28px; border-radius: 999px;">
                      Claim on Delulu
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 24px 0 0; font-size: 13px; color: #6b7280; line-height: 1.6; text-align: center;">
                This opens the Delulu app on your Rewards page.
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #e5e7eb; background-color: #fafafa;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
                You received this because you have a Delulu account.
                <a href="${appUrl}/settings" style="color: #6b7280;">Manage preferences</a>
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

export function rewardNotificationEmailText(data: RewardNotificationEmailData): string {
  const lines = [
    `Hi ${data.username},`,
    "",
    "Your Delulu reward is ready.",
    "",
    "The Delulu team added a reward to your account. You can review it on your Rewards page.",
  ];
  if (data.reason) {
    lines.push("", `Note from the team: ${data.reason}`);
  }
  lines.push(
    "",
    `Amount: ${data.amountLabel} ${data.tokenSymbol}`,
    "",
    `Claim on Delulu (Rewards): ${data.claimUrl}`,
    "",
    "— Delulu",
  );
  return lines.join("\n");
}

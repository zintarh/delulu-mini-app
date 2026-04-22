export interface ReminderEmailData {
  username: string;
  goalTitle: string;
  pendingHabits: { emoji: string; title: string }[];
  appUrl: string;
  ctaUrl?: string;
  manageUrl?: string;
  ctaLabel?: string;
  streakDays?: number;
}

export function reminderEmailHtml(data: ReminderEmailData): string {
  const {
    username,
    goalTitle,
    pendingHabits,
    appUrl,
    ctaUrl,
    manageUrl,
    ctaLabel,
    streakDays,
  } = data;
  const finalCtaUrl = ctaUrl ?? appUrl;
  const finalManageUrl = manageUrl ?? `${appUrl}/profile`;
  const finalCtaLabel = ctaLabel ?? "Check in now";

  const habitRows = pendingHabits
    .slice(0, 3)
    .map(
      (h) => `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #1e1e1e; font-size: 14px; color: #d4d4d4;">
          <span style="font-size: 18px; margin-right: 10px;">${h.emoji}</span>${h.title}
        </td>
      </tr>`
    )
    .join("");

  const streakBadge =
    streakDays && streakDays > 1
      ? `<p style="margin: 0 0 24px; font-size: 13px; color: #888; text-align: center;">
          🔥 You're on a <strong style="color: #fcff52;">${streakDays}-day streak</strong> — don't break it now.
        </p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your goals are waiting</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0a0a0a; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #0a0a0a; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 480px; background-color: #111111; border-radius: 20px; overflow: hidden; border: 1px solid #1e1e1e;">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #1e1e1e;">
              <img src="${appUrl}/favicon_io/android-chrome-192x192.png" alt="Delulu" width="48" height="48"
                style="border-radius: 12px; margin-bottom: 16px; display: block; margin: 0 auto 12px;" />
              <p style="margin: 0; font-size: 12px; font-weight: 700; letter-spacing: 2px; text-transform: uppercase; color: #555;">delulu</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">

              <h1 style="margin: 0 0 8px; font-size: 26px; font-weight: 900; color: #ffffff; line-height: 1.2;">
                Hey ${username}, your goals miss you 👀
              </h1>

              <p style="margin: 0 0 24px; font-size: 15px; color: #888; line-height: 1.6;">
                You're working towards <strong style="color: #ffffff;">${goalTitle}</strong>.
                The only way to get there is one habit at a time.
              </p>

              ${streakBadge}

              <!-- Habit list -->
              <p style="margin: 0 0 12px; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #555;">
                Still pending
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background-color: #0d0d0d; border-radius: 12px; overflow: hidden; border: 1px solid #1e1e1e; margin-bottom: 28px;">
                <tbody>${habitRows}</tbody>
              </table>

              <!-- CTA -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${finalCtaUrl}"
                      style="display: inline-block; background-color: #fcff52; color: #111111; font-size: 15px; font-weight: 900;
                             text-decoration: none; padding: 16px 40px; border-radius: 14px;
                             border: 2px solid #1a1a1a; box-shadow: 4px 4px 0px #1a1a1a; letter-spacing: 0.3px;">
                      ${finalCtaLabel} →
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #1e1e1e; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #444; line-height: 1.5;">
                You're receiving this because you have an active goal on Delulu.
              </p>
              <p style="margin: 0; font-size: 12px; color: #333;">
                <a href="${finalManageUrl}" style="color: #555; text-decoration: underline;">Manage notifications</a>
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

export function reminderEmailText(data: ReminderEmailData): string {
  const { username, goalTitle, pendingHabits, appUrl } = data;
  const habits = pendingHabits
    .slice(0, 3)
    .map((h) => `  ${h.emoji} ${h.title}`)
    .join("\n");

  return `Hey ${username},

Your goals are waiting for you.

You're working towards: ${goalTitle}

Still pending:
${habits}

Check in now: ${appUrl}

—
Delulu · Manage notifications: ${appUrl}/profile`;
}

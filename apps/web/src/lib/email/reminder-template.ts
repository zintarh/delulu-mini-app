export interface ReminderEmailData {
  username: string;
  goalTitle: string;
  pendingHabits: {
    emoji: string;
    title: string;
    context?: string;
    milestoneTitle?: string;
    timeLeftText?: string;
    ctaUrl?: string;
    ctaLabel?: string;
  }[];
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
  const finalCtaUrl = ctaUrl ?? pendingHabits[0]?.ctaUrl ?? appUrl;
  const finalManageUrl = manageUrl ?? `${appUrl}/profile`;
  const finalCtaLabel = ctaLabel ?? "Submit proof";

  const habitRows = pendingHabits
    .slice(0, 3)
    .map(
      (h) => `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #e5e7eb; color: #111827;">
          <div>
            <div style="flex: 1; min-width: 0;">
              <p style="margin: 0; font-size: 14px; color: #111827; font-weight: 700;">${h.title}</p>
              ${
                h.milestoneTitle
                  ? `<p style="margin: 5px 0 0; font-size: 12px; color: #4b5563; line-height: 1.5;">
                      Milestone: ${h.milestoneTitle}
                    </p>`
                  : h.context
                    ? `<p style="margin: 5px 0 0; font-size: 12px; color: #4b5563; line-height: 1.5;">${h.context}</p>`
                    : ""
              }
              ${
                h.timeLeftText
                  ? `<p style="margin: 6px 0 0; font-size: 12px; line-height: 1.4;">
                      <span style="display: inline-block; background: #fff8b8; color: #1f2937; border: 1px solid #f2de5a; padding: 2px 8px; border-radius: 999px; font-weight: 700;">
                        ${h.timeLeftText}
                      </span>
                    </p>`
                  : ""
              }
            </div>
          </div>
        </td>
      </tr>`
    )
    .join("");

  const streakBadge =
    streakDays && streakDays > 1
      ? `<p style="margin: 0 0 24px; font-size: 13px; color: #888; text-align: center;">
          You're on a <strong style="color: #111827;">${streakDays}-day streak</strong>. Keep the vibe going.
        </p>`
      : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Your milestone needs you</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 700px; background-color: #ffffff; border-radius: 20px; overflow: hidden; border: 1px solid #e5e7eb;">

          <!-- Header -->
          <tr>
            <td style="padding: 32px 32px 24px; text-align: center; border-bottom: 1px solid #e5e7eb;">
              <img src="${appUrl}/favicon_io/android-chrome-192x192.png" alt="Delulu" width="52" height="52"
                style="border-radius: 14px; display: block; margin: 0 auto 12px;" />
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding: 32px;">

              <h1 style="margin: 0 0 4px; font-size: 25px; font-weight: 900; color: #111827; line-height: 1.2;">
                Hey ${username} 💛
              </h1>
              <h2 style="margin: 0 0 12px; font-size: 22px; font-weight: 900; color: #111827; line-height: 1.2;">
                Your milestone is waiting
              </h2>

              <p style="margin: 0 0 16px; font-size: 15px; color: #374151; line-height: 1.7;">
                Your next step is close, and you have this.
                Show up, submit proof, and keep your momentum moving.
              </p>
              <p style="margin: 0 0 24px; font-size: 15px; color: #4b5563; line-height: 1.6;">
                <strong style="color: #111827;">${goalTitle}</strong>
              </p>

              ${streakBadge}

              <!-- Habit list -->
              <p style="margin: 0 0 12px; font-size: 12px; font-weight: 700; letter-spacing: 1.5px; text-transform: uppercase; color: #6b7280;">
                Milestones to submit soon
              </p>
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
                style="background-color: #f9fafb; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; margin-bottom: 20px;">
                <tbody>${habitRows}</tbody>
              </table>

              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${finalCtaUrl}"
                      style="display: inline-block; background-color: #fcff52; color: #111111; font-size: 14px; font-weight: 900;
                             text-decoration: none; padding: 14px 30px; border-radius: 12px;
                             border: 2px solid #1a1a1a; box-shadow: 3px 3px 0px #1a1a1a; letter-spacing: 0.2px;">
                      ${finalCtaLabel}
                    </a>
                  </td>
                </tr>
              </table>

            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding: 20px 32px; border-top: 1px solid #e5e7eb; text-align: center;">
              <p style="margin: 0 0 6px; font-size: 12px; color: #6b7280; line-height: 1.5;">
                You're receiving this because you have an active delulu with ongoing milestones.
              </p>
              <p style="margin: 0; font-size: 12px; color: #6b7280;">
                <a href="${finalManageUrl}" style="color: #4b5563; text-decoration: underline;">Manage notifications</a>
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
    .map(
      (h) =>
        `  ${h.title}${h.milestoneTitle ? ` (Milestone: ${h.milestoneTitle})` : h.context ? ` (${h.context})` : ""}${h.timeLeftText ? ` [${h.timeLeftText}]` : ""}${h.ctaUrl ? ` -> ${h.ctaUrl}` : ""}`,
    )
    .join("\n");

  return `Hey ${username},

Your goals are waiting for you.

You're working towards: ${goalTitle}

Still pending:
${habits}

Submit proof: ${data.ctaUrl ?? pendingHabits[0]?.ctaUrl ?? appUrl}

Delulu. Manage notifications: ${appUrl}/profile`;
}

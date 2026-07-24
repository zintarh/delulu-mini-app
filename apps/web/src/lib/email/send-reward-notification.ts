import { Resend } from "resend";
import {
  rewardNotificationEmailHtml,
  rewardNotificationEmailText,
  type RewardNotificationEmailData,
} from "./reward-template";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendRewardNotificationEmail(
  to: string,
  data: RewardNotificationEmailData,
) {
  const from =
    process.env.RESEND_FROM_EMAIL ?? "Delulu <onboarding@resend.dev>";
  // Keep amount/token out of the subject — money + claim language triggers spam filters.
  const subject = "Your Delulu reward is ready";
  const settingsUrl = `${data.appUrl.replace(/\/$/, "")}/settings`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: rewardNotificationEmailHtml(data),
    text: rewardNotificationEmailText(data),
    headers: {
      "List-Unsubscribe": `<${settingsUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) throw error;
}

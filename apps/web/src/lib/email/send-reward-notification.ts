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
    process.env.RESEND_FROM_EMAIL ?? "Zinta from Delulu <onboarding@resend.dev>";
  const subject = `You received ${data.amountLabel} ${data.tokenSymbol} on Delulu`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: rewardNotificationEmailHtml(data),
    text: rewardNotificationEmailText(data),
  });

  if (error) throw error;
}

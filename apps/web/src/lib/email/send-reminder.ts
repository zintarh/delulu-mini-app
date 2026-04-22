import { Resend } from "resend";
import { reminderEmailHtml, reminderEmailText, type ReminderEmailData } from "./reminder-template";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function sendReminderEmail(
  to: string,
  data: ReminderEmailData,
  options?: { subject?: string },
) {
  const from = process.env.RESEND_FROM_EMAIL ?? "Delulu <onboarding@resend.dev>";
  const subject = options?.subject ?? `${data.username}, your goals are waiting 🎯`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html: reminderEmailHtml(data),
    text: reminderEmailText(data),
  });

  if (error) throw error;
}

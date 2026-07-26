import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export interface VerifierInviteEmailData {
  creatorUsername: string | null;
  creatorWallet: string;
  commitmentTitle: string;
  inviteUrl: string;
  appUrl: string;
}

/**
 * Sent immediately when a forfeit commitment names a friend as verifier. The link
 * carries a one-time invite code (never persisted server-side, only its hash is —
 * see acceptVerifierInvite in ForfeitMarket.sol) that binds the friend's wallet as
 * the on-chain verifier once they open it and connect.
 */
export async function sendVerifierInviteEmail(to: string, data: VerifierInviteEmailData) {
  const from = process.env.RESEND_FROM_EMAIL ?? "Delulu <onboarding@resend.dev>";
  const creatorLabel = data.creatorUsername
    ? `@${data.creatorUsername}`
    : `${data.creatorWallet.slice(0, 6)}...${data.creatorWallet.slice(-4)}`;
  const subject = `${creatorLabel} asked you to verify their forfeit`;
  const settingsUrl = `${data.appUrl.replace(/\/$/, "")}/settings`;

  const html = `
    <div style="font-family: -apple-system, sans-serif; max-width: 480px; margin: 0 auto;">
      <p>${creatorLabel} started a forfeit on Delulu and named you as their verifier:</p>
      <p style="font-weight: 700; font-size: 16px;">${data.commitmentTitle}</p>
      <p>They've staked money on completing it. When they submit proof, you'll review it and confirm whether they did it — not AI, not them.</p>
      <p><a href="${data.inviteUrl}" style="display:inline-block; background:#1a1a19; color:#fff; padding:12px 24px; border-radius:999px; text-decoration:none; font-weight:700;">Accept and review</a></p>
      <p style="color:#888; font-size:12px;">If you don't respond before the deadline, their commitment resolves as missed — same as if you'd reviewed and rejected it.</p>
    </div>
  `;
  const text = `${creatorLabel} started a forfeit on Delulu ("${data.commitmentTitle}") and named you as their verifier. Accept and review: ${data.inviteUrl}`;

  const { error } = await resend.emails.send({
    from,
    to,
    subject,
    html,
    text,
    headers: {
      "List-Unsubscribe": `<${settingsUrl}>`,
      "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
    },
  });

  if (error) throw error;
}

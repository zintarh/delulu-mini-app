import { escapeMarketingHtml, normalizeMarketingAppUrl } from "@/lib/marketing-email-template";

/**
 * "Referrals reopen tomorrow" — sent to past top referrers. Same Lulu look as
 * the outreach emails (cream page, ink-outlined card, chunky yellow button),
 * with the offer as a big block you can't miss. Tables + inline styles so
 * Gmail, Outlook and Apple Mail all render it.
 */
export type ReferralLaunchEmail = {
  name: string;
  /** Friends they brought last time (onboarded). */
  friends: number;
  reward: number;
  /** "Wed 18 Nov" */
  opensOn: string;
  /** "Tue 24 Nov" */
  roundEnds: string;
};

export function referralLaunchSubject(e: ReferralLaunchEmail): string {
  return `🔥 Tomorrow: ${e.reward.toLocaleString("en-US")} G$ for every friend you bring`;
}

export function buildReferralLaunchHtml(appUrlRaw: string, e: ReferralLaunchEmail): string {
  const appUrl = normalizeMarketingAppUrl(appUrlRaw);
  const href = `${appUrl}/rewards#invite`;
  const lulu = `${appUrl}/favicon_io/android-chrome-192x192.png`;
  const font = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const name = escapeMarketingHtml(e.name);
  const reward = e.reward.toLocaleString("en-US");
  const p = (html: string) => `<p style="margin:0 0 14px;font-family:${font};font-size:16px;line-height:1.6;color:#3a3a37;">${html}</p>`;
  const step = (n: number, html: string) =>
    `<tr><td valign="top" style="padding:0 12px 12px 0;"><div style="width:28px;height:28px;border-radius:14px;background:#161615;color:#fff;font-family:${font};font-size:14px;font-weight:800;line-height:28px;text-align:center;">${n}</div></td><td style="padding:3px 0 12px;font-family:${font};font-size:15px;line-height:1.5;color:#3a3a37;">${html}</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><title>${escapeMarketingHtml(referralLaunchSubject(e))}</title></head>
<body style="margin:0;padding:0;background:#fdf1c7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">You're one of our top referrers — referrals reopen ${escapeMarketingHtml(e.opensOn)}, ${reward} G$ per friend.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf1c7;"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td align="center" style="padding-bottom:12px;"><img src="${lulu}" width="64" height="64" alt="Lulu" style="display:block;border:0;" /></td></tr>
  <tr><td style="background:#ffffff;border:2px solid #161615;border-radius:22px;padding:28px 26px;">
    <p style="margin:0 0 6px;font-family:${font};font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#c25e12;">🏆 Top referrer · early access</p>
    <h1 style="margin:0 0 16px;font-family:${font};font-size:26px;line-height:1.2;font-weight:800;color:#161615;">${name}, you're one of our best — so you hear it first</h1>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:4px 0 20px;background:#f6c324;border:2px solid #161615;border-radius:18px;">
      <tr><td align="center" style="padding:22px 16px 18px;">
        <p style="margin:0;font-family:${font};font-size:13px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#161615;">Referrals reopen ${escapeMarketingHtml(e.opensOn)}</p>
        <p style="margin:6px 0 0;font-family:${font};font-size:52px;line-height:1;font-weight:900;color:#161615;">${reward} G$</p>
        <p style="margin:6px 0 0;font-family:${font};font-size:18px;font-weight:800;color:#161615;">for every friend you bring 🎉</p>
        <p style="margin:12px 0 0;font-family:${font};font-size:13px;font-weight:700;color:#4a3d0a;">Round 1 runs until ${escapeMarketingHtml(e.roundEnds)} · each week's budget is limited</p>
      </td></tr>
    </table>

    ${p(`Last time you brought <b>${e.friends} friends</b> to Delulu. That put you at the top — so before anyone else, here's the news: <b>referrals are back tomorrow, and every friend is now worth ${reward} G$</b>.`)}
    ${p(`And it's easier for your friends than ever: they start with <b>1,000 G$ free</b> to play their first Bingo.`)}

    <p style="margin:6px 0 10px;font-family:${font};font-size:15px;font-weight:800;color:#161615;">How you earn:</p>
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 8px;">
      ${step(1, `Grab your link: <b>Rewards → Invite friends</b> (it unlocks at midnight).`)}
      ${step(2, `Your friend signs up, does a quick face check and gets <b>1,000 G$ free</b>.`)}
      ${step(3, `They put it into their first Bingo and post their first photo — <b>${reward} G$ lands with you</b>.`)}
    </table>

    ${p(`Every week has its own budget, so <b>the earliest invites count first</b>. Line your friends up tonight. 😉`)}

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:#f6c324;border:2px solid #161615;border-radius:14px;box-shadow:0 4px 0 #c99a0a;">
      <a href="${href}" style="display:inline-block;padding:15px 26px;font-family:${font};font-size:16px;font-weight:800;color:#161615;text-decoration:none;">Get my invite link →</a>
    </td></tr></table>

    <p style="margin:0;font-family:${font};font-size:15px;line-height:1.5;color:#3a3a37;">Let's go,<br /><b style="color:#161615;">Lulu</b> 💛</p>
  </td></tr>
  <tr><td align="center" style="padding:16px 8px 0;font-family:${font};font-size:12px;line-height:1.6;color:#6b6b63;">
    You're getting this because you referred friends to Delulu.<br />A friend counts once they're face-verified and earn 1,000 points (their first approved photo in a 1,000 G$ Bingo).<br /><a href="${appUrl}" style="color:#6b6b63;">staydelulu.xyz</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function buildReferralLaunchText(appUrlRaw: string, e: ReferralLaunchEmail): string {
  const appUrl = normalizeMarketingAppUrl(appUrlRaw);
  const reward = e.reward.toLocaleString("en-US");
  return [
    `${e.name}, you're one of our top referrers — so you hear it first.`,
    ``,
    `REFERRALS REOPEN ${e.opensOn.toUpperCase()}: ${reward} G$ FOR EVERY FRIEND YOU BRING`,
    `Round 1 runs until ${e.roundEnds}. Each week's budget is limited — earliest invites count first.`,
    ``,
    `Last time you brought ${e.friends} friends to Delulu. Your friends now start with 1,000 G$ free to play their first Bingo.`,
    ``,
    `1. Grab your link: Rewards → Invite friends (unlocks at midnight).`,
    `2. Your friend signs up, does a quick face check and gets 1,000 G$ free.`,
    `3. They put it into their first Bingo and post their first photo — ${reward} G$ lands with you.`,
    ``,
    `Get my invite link: ${appUrl}/rewards#invite`,
    ``,
    `Let's go,`,
    `Lulu`,
  ].join("\n");
}

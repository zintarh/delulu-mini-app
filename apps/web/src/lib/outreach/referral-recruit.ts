import { escapeMarketingHtml, normalizeMarketingAppUrl } from "@/lib/marketing-email-template";

/**
 * "Bring friends, get paid" — recruits referrers from people who already know
 * Delulu (active 5+ days, active lately, or referred before). Shows the live
 * referrer leaderboard, their own link (or the steps that unlock it), what a
 * friend pays them and how many spots are left this week. Lulu look; tables +
 * inline styles so Gmail, Outlook and Apple Mail render it. Pure — no sending.
 */
export type RecruitLeader = { name: string; friends: number; earnedG: number };

export type RecruitEmail = {
  name: string;
  /** Their personal invite link, or null when referring isn't unlocked yet. */
  link: string | null;
  /** What still blocks them from earning (shown when link is null). */
  missingSteps: string[];
  /** Friends they've brought this season and what it paid them. */
  myFriends: number;
  myEarnedG: number;
  leaders: RecruitLeader[];
  reward: number;
  firstPayment: number;
  /** "≈ ₦720" for the reward */
  rewardNaira: string;
  /** What the friend's First Week pays them: "6,750 G$ (≈ ₦970)" */
  friendGets: string;
  spotsLeft: number;
  spots: number;
  /** "Mon 23 Nov" — last day of this week's round */
  roundEnds: string;
};

const k = (n: number) => n.toLocaleString("en-US");

export function recruitSubject(e: RecruitEmail): string {
  const top = e.leaders[0];
  return top
    ? `${top.name} made ${k(top.earnedG)} G$ this week inviting friends. Your turn 💛`
    : `${k(e.reward)} G$ for every friend you bring to Delulu 💛`;
}

export function buildRecruitHtml(appUrlRaw: string, e: RecruitEmail): string {
  const appUrl = normalizeMarketingAppUrl(appUrlRaw);
  const font = "'Helvetica Neue',Helvetica,Arial,sans-serif";
  const lulu = `${appUrl}/favicon_io/android-chrome-192x192.png`;
  const esc = escapeMarketingHtml;
  const rest = e.reward - e.firstPayment;
  const p = (html: string) => `<p style="margin:0 0 14px;font-family:${font};font-size:16px;line-height:1.6;color:#3a3a37;">${html}</p>`;
  const medal = ["🥇", "🥈", "🥉"];

  const rows = e.leaders
    .map(
      (l, i) => `<tr>
        <td style="padding:10px 0 10px 14px;border-top:${i ? "1px solid #eee3c0" : "0"};font-family:${font};font-size:15px;font-weight:800;color:#161615;width:34px;">${medal[i] ?? `#${i + 1}`}</td>
        <td style="padding:10px 6px;border-top:${i ? "1px solid #eee3c0" : "0"};font-family:${font};font-size:15px;font-weight:800;color:#161615;">${esc(l.name)}<br /><span style="font-size:12px;font-weight:600;color:#6b6b63;">${l.friends} friend${l.friends === 1 ? "" : "s"}</span></td>
        <td align="right" style="padding:10px 14px 10px 6px;border-top:${i ? "1px solid #eee3c0" : "0"};font-family:${font};font-size:16px;font-weight:900;color:#1a7f43;white-space:nowrap;">+${k(l.earnedG)} G$</td>
      </tr>`,
    )
    .join("");

  const linkBlock = e.link
    ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#161615;border-radius:18px;">
        <tr><td style="padding:18px 18px 16px;">
          <p style="margin:0 0 8px;font-family:${font};font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#f6c324;">Your link — send it to friends</p>
          <p style="margin:0;font-family:'Courier New',monospace;font-size:15px;font-weight:700;line-height:1.4;color:#ffffff;word-break:break-all;"><a href="${esc(e.link)}" style="color:#ffffff;text-decoration:none;">${esc(e.link.replace(/^https?:\/\//, ""))}</a></p>
          <p style="margin:10px 0 0;font-family:${font};font-size:13px;line-height:1.5;color:#c9c6b8;">Long-press to copy it, or find it any time in the app: <b style="color:#fff;">Rewards → Invite friends</b>.</p>
        </td></tr>
      </table>`
    : `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;background:#fff8e1;border:2px dashed #161615;border-radius:18px;">
        <tr><td style="padding:16px 18px;">
          <p style="margin:0 0 8px;font-family:${font};font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#c25e12;">🔒 Unlock your link first</p>
          <p style="margin:0 0 8px;font-family:${font};font-size:15px;line-height:1.5;color:#3a3a37;">You're close. Finish ${e.missingSteps.length === 1 ? "this" : "these"} in the app and your invite link opens:</p>
          ${e.missingSteps.map((s) => `<p style="margin:0 0 4px;font-family:${font};font-size:15px;font-weight:700;color:#161615;">☐ ${esc(s)}</p>`).join("")}
        </td></tr>
      </table>`;

  const mine =
    e.myFriends > 0
      ? p(`You've already brought <b>${e.myFriends} friend${e.myFriends === 1 ? "" : "s"}</b> this season${e.myEarnedG > 0 ? ` and earned <b>${k(e.myEarnedG)} G$</b>` : ""}. Keep going — there's no limit per person.`)
      : "";

  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" /><meta name="color-scheme" content="light" /><title>${esc(recruitSubject(e))}</title></head>
<body style="margin:0;padding:0;background:#fdf1c7;">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${k(e.reward)} G$ for every friend you bring. ${e.spotsLeft} of ${e.spots} spots left this week.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fdf1c7;"><tr><td align="center" style="padding:28px 14px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;">
  <tr><td align="center" style="padding-bottom:12px;"><img src="${lulu}" width="64" height="64" alt="Lulu" style="display:block;border:0;" /></td></tr>
  <tr><td style="background:#ffffff;border:2px solid #161615;border-radius:22px;padding:28px 24px;">
    <p style="margin:0 0 6px;font-family:${font};font-size:12px;font-weight:800;letter-spacing:1.5px;text-transform:uppercase;color:#c25e12;">🔥 Season 2 referrals</p>
    <h1 style="margin:0 0 16px;font-family:${font};font-size:26px;line-height:1.2;font-weight:800;color:#161615;">${esc(e.name)}, your friends can make you money</h1>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f6c324;border:2px solid #161615;border-radius:18px;">
      <tr><td align="center" style="padding:20px 16px 16px;">
        <p style="margin:0;font-family:${font};font-size:48px;line-height:1;font-weight:900;color:#161615;">${k(e.reward)} G$</p>
        <p style="margin:6px 0 0;font-family:${font};font-size:17px;font-weight:800;color:#161615;">for every friend you bring · ${esc(e.rewardNaira)}</p>
        <p style="margin:12px 0 0;font-family:${font};font-size:13px;font-weight:800;color:#4a3d0a;">Only ${e.spotsLeft} of ${e.spots} spots left this week · ends ${esc(e.roundEnds)}</p>
      </td></tr>
    </table>

    <p style="margin:0 0 8px;font-family:${font};font-size:15px;font-weight:800;color:#161615;">🏆 This week's top referrers</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#fffbea;border:2px solid #161615;border-radius:16px;">${rows}</table>

    ${mine}
    ${linkBlock}

    <p style="margin:0 0 8px;font-family:${font};font-size:15px;font-weight:800;color:#161615;">How you get paid</p>
    ${p(`💸 <b>+${k(e.firstPayment)} G$</b> when your friend does a quick face check and posts their first photo.<br />🔥 <b>+${k(rest)} G$ more</b> when they show up 3 days in a row.`)}
    ${p(`And your friend wins too: their First Week pays them <b>${esc(e.friendGets)}</b> for one photo a day.`)}

    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 20px;"><tr><td style="background:#f6c324;border:2px solid #161615;border-radius:14px;">
      <a href="${appUrl}/rewards#invite" style="display:inline-block;padding:15px 26px;font-family:${font};font-size:16px;font-weight:800;color:#161615;text-decoration:none;">${e.link ? "Share my link" : "Unlock my link"} →</a>
    </td></tr></table>

    <p style="margin:0;font-family:${font};font-size:15px;line-height:1.5;color:#3a3a37;">Spots go first come, first served,<br /><b style="color:#161615;">Lulu</b> 💛</p>
  </td></tr>
  <tr><td align="center" style="padding:16px 8px 0;font-family:${font};font-size:12px;line-height:1.6;color:#6b6b63;">
    You're getting this because you have a Delulu account.<br />A friend counts once they sign up with your link, are face-verified and post their first photo. When this week's spots are full, new friends count toward next week.<br /><a href="${appUrl}/settings" style="color:#6b6b63;">Email preferences</a> · <a href="${appUrl}" style="color:#6b6b63;">staydelulu.xyz</a>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

export function buildRecruitText(appUrlRaw: string, e: RecruitEmail): string {
  const appUrl = normalizeMarketingAppUrl(appUrlRaw);
  return [
    `${e.name}, your friends can make you money.`,
    ``,
    `${k(e.reward)} G$ FOR EVERY FRIEND YOU BRING (${e.rewardNaira})`,
    `Only ${e.spotsLeft} of ${e.spots} spots left this week · ends ${e.roundEnds}`,
    ``,
    `This week's top referrers:`,
    ...e.leaders.map((l, i) => `${i + 1}. ${l.name} — ${l.friends} friends, +${k(l.earnedG)} G$`),
    ``,
    e.link ? `Your link: ${e.link}` : `Unlock your link first:\n${e.missingSteps.map((s) => `- ${s}`).join("\n")}`,
    ``,
    `How you get paid:`,
    `+${k(e.firstPayment)} G$ when your friend does a quick face check and posts their first photo.`,
    `+${k(e.reward - e.firstPayment)} G$ more when they show up 3 days in a row.`,
    `Your friend's First Week pays them ${e.friendGets}.`,
    ``,
    `${e.link ? "Share my link" : "Unlock my link"}: ${appUrl}/rewards#invite`,
    ``,
    `Lulu`,
  ].join("\n");
}

/** Money formatting shared by server (nudges) and client (Home card) — no server imports. */
export type Money = { g: number; usd: number; ngn: number };
export type Earner = { name: string; usd: number; ngn: number };
export type SevenDay = { slug: string; title: string; entry: Money; top: Money; perPhoto: number };
export type EarnFacts = {
  gdUsd: number;
  ngnPerUsd: number;
  /** The regular 7-day Bingo (everyone). */
  sevenDay: SevenDay | null;
  /** "Your First Week": the one-time welcome Bingo for new and invited players. Null until it's live. */
  firstWeek: SevenDay | null;
  topReferrers: Earner[];
  topCampaign: Earner[];
};

export const toMoney = (g: number, gdUsd: number, ngnPerUsd: number): Money => {
  const usd = g * gdUsd;
  return { g, usd, ngn: usd * ngnPerUsd };
};

/** "$1.01" / "$12" · "₦1,370" */
export const fmtUsd = (usd: number) => `$${usd >= 10 ? Math.round(usd).toLocaleString("en-US") : usd.toFixed(2)}`;
export const fmtNgn = (ngn: number) => `₦${(ngn >= 1000 ? Math.round(ngn / 10) * 10 : Math.round(ngn)).toLocaleString("en-US")}`;
export const fmtMoney = (m: Pick<Money, "usd" | "ngn">) => `${fmtUsd(m.usd)} (≈ ${fmtNgn(m.ngn)})`;

/** "metakay23 $9.12 (≈ ₦12,330) · Hekii …" */
export const earnersLine = (list: Earner[]) => list.map((e) => `@${e.name} ${fmtMoney(e)}`).join(" · ");

/**
 * Naira worth showing next to a G$ amount: tiny figures ("≈ ₦13") make a
 * reward look worthless, so below ₦100 we show nothing and let G$ speak.
 */
export const MIN_NGN_SHOWN = 100;
export const ngnWorthShowing = (ngn: number | null | undefined) => (ngn != null && ngn >= MIN_NGN_SHOWN ? fmtNgn(ngn) : null);

import { ACTIVE_POT } from "@/lib/pool/tickets";
import { NAIRA_CASHOUT_MIN_G } from "@/lib/rewards/cash-out";
import { STARTER_STAKE } from "@/lib/bingo/starter";

const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * One email for someone who created an account and never started a card.
 * The words match the live rules: 10% on the stake, the weekly pool, and
 * cashing G$ to a Naira bank account. No extra prizes.
 */
export function signupIdleEmail() {
  const pool = fmt(ACTIVE_POT.weeklyG);
  return {
    subject: "You signed up. Here's why it's worth coming back",
    heading: "A habit, with a little money on it",
    body:
      `You made a Delulu account and haven't started yet. That's usually where a new habit slips, so here is the whole thing in one note.\n\n` +
      `Delulu is for keeping a habit. You stake a little GoodDollar (G$) on a 7-day Bingo and post one photo a day. The money is there so the habit is harder to drop.\n\n` +
      `Keep every day and your stake comes back, plus 10%: a little on each day you keep, and the rest when you finish. Miss a day and that stake is forfeited.\n\n` +
      `There is also a weekly pool of ${pool} G$, shared by everyone who shows up all 7 days. In your first ${ACTIVE_POT.newcomerDays} days, showing up the whole week is enough to be in that pool.\n\n` +
      `From ${fmt(NAIRA_CASHOUT_MIN_G)} G$ you can cash G$ to a Naira bank account in the app.\n\n` +
      `Come back, choose your own username and a photo, and start with ${fmt(STARTER_STAKE)} G$ on a first card. One small habit. We'll be here tomorrow.`,
    cta: "Come back and start",
    path: "/sign-in",
  };
}

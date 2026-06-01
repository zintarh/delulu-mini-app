export type GoodDollarWhitelistAction = "tip" | "create";

export const WHITELIST_CLAIM_MESSAGES: Record<
  GoodDollarWhitelistAction,
  { title: string; body: string }
> = {
  tip: {
    title: "Verify to tip with G$",
    body: "Tipping uses GoodDollar. Verify your identity and whitelist this wallet on Celo before you send a tip.",
  },
  create: {
    title: "Verify to create a delulu",
    body: "Creating a delulu stakes G$. Verify your identity and whitelist this wallet on Celo before you publish.",
  },
};

export const WHITELIST_TOAST_MESSAGES: Record<GoodDollarWhitelistAction, string> = {
  tip: "Verify and whitelist your wallet to tip with G$.",
  create: "Verify and whitelist your wallet to create a delulu.",
};

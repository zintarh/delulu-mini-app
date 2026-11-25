import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How Delulu works",
  description:
    "What GoodDollar is, how staking a Bingo works, how points are earned, and how the weekly $100 (1,000,000 G$) is shared.",
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}

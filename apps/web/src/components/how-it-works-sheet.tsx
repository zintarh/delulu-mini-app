"use client";

import { ResponsiveSheet } from "@/components/ui/responsive-sheet";

interface HowItWorksSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "concept" | "market" | "conviction";
}

const explanations = {
  concept: {
    title: "What is Delulu?",
    steps: [
      {
        title: "Your Wild Claims",
        description:
          "Delulu transforms personal goals, opinions, and viral topics into verifiable, on-chain predictions.",
      },
      {
        title: "Stake Your Conviction",
        description:
          "Put real money behind your delusions. The creator stakes to believe in their own claim, showing genuine conviction.",
      },
      {
        title: "Community Consensus",
        description:
          "Others can stake to believe or doubt. The ratio of stakes represents the collective 'Price of Conviction'.",
      },
      {
        title: "Monetize Ambition",
        description:
          "Winners take the staked pot, gaining both financial profit and powerful social validation for being right.",
      },
    ],
    icon: "✨",
  },
  market: {
    title: "The Prediction Market",
    steps: [
      {
        title: "Believe vs Doubt",
        description:
          "Every delulu has two sides: believers who think it will come true, and doubters who bet against it.",
      },
      {
        title: "Dynamic Pricing",
        description:
          "The ratio of believer to doubter stakes creates a market price. More believers = higher conviction price.",
      },
      {
        title: "Winner Takes All",
        description:
          "When the deadline passes, the outcome is determined. Winners split the losing side's stakes proportionally.",
      },
      {
        title: "On-Chain Transparency",
        description:
          "Everything is verifiable on the blockchain. No manipulation, no disputes—just pure conviction.",
      },
    ],
    icon: "📊",
  },
  conviction: {
    title: "Your Conviction Pays",
    steps: [
      {
        title: "Back Your Beliefs",
        description:
          "Stake cUSD to show you genuinely believe in a delulu. The more you stake, the more you can win.",
      },
      {
        title: "Potential Payouts",
        description:
          "If you're right, you win a share of the opposing side's stakes. The earlier you stake, the better your odds.",
      },
      {
        title: "Social Validation",
        description:
          "Being right isn't just about money—it's about proving your judgment and gaining credibility in the community.",
      },
      {
        title: "Claim Your Rewards",
        description:
          "Once a delulu is resolved, claim your winnings from the rewards card. Your conviction paid off!",
      },
    ],
    icon: "💰",
  },
};

export function HowItWorksSheet({
  open,
  onOpenChange,
  type,
}: HowItWorksSheetProps) {
  const content = explanations[type];

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={onOpenChange}
      title={content.title}
      sheetClassName="border-t-2 border-white/10 max-h-[90vh] overflow-hidden p-0 rounded-t-3xl bg-black [&>button]:text-white [&>button]:bg-black/80 [&>button]:hover:bg-black/20"
      modalClassName="max-w-2xl"
    >
        <div className="relative flex flex-col overflow-y-auto pb-8">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="mb-6">
              <h2 className="text-lg font-black text-white">
                {content.title}
              </h2>
            </div>

            {/* Steps */}
            <div className="space-y-4">
              {content.steps.map((step, index) => (
                <div
                  key={index}
                  className="bg-black rounded-2xl p-4 border border-white/10"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-black/20 flex items-center justify-center shrink-0">
                      <span className="text-sm font-black text-white">
                        {index + 1}
                      </span>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-black text-white mb-1">
                        {step.title}
                      </h3>
                      <p className="text-sm text-white/70 leading-relaxed">
                        {step.description}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
    </ResponsiveSheet>
  );
}

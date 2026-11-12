"use client";

import { useState } from "react";
import { Globe2, Lock } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { Coin, GameButton, Lulu } from "@/components/ds";
import { queueVisibilityChoice } from "@/lib/support/pending-visibility";

/**
 * "Contract signed!" + the one-tap visibility question. Private is the
 * default: closing the sheet or tapping "Keep it private" changes nothing.
 */
export function ContractSignedSheet({
  open,
  txHash,
  wallet,
  onDone,
}: {
  open: boolean;
  /** Create tx of the Delulu just signed; null while resuming without one. */
  txHash: string | null;
  wallet: string | null | undefined;
  onDone: () => void;
}) {
  const [choice, setChoice] = useState<"public" | null>(null);
  const canAsk = !!txHash && !!wallet;

  const makePublic = () => {
    if (!txHash || !wallet) return;
    setChoice("public");
    // Lands whenever the background save finishes — no need to wait here.
    void queueVisibilityChoice(txHash, wallet, true);
    window.setTimeout(onDone, 900);
  };

  return (
    <ResponsiveSheet
      open={open}
      onOpenChange={(o) => {
        if (!o) onDone();
      }}
      title="Contract signed!"
      sheetClassName="rounded-t-3xl pb-8"
      modalClassName="max-w-md"
    >
      <div className="flex flex-col items-center gap-2 pb-2 text-center">
        <span className="relative">
          <Lulu size={84} mood="kept" />
          <Coin size={28} className="absolute -right-4 top-1 rotate-12 animate-bounce-in" />
        </span>
        <p className="m-0 text-sm leading-snug text-muted-foreground">
          Your stake is locked in. Prove it each day to keep it.
        </p>
      </div>

      {canAsk ? (
        <div className="mt-4 rounded-[20px] border-2 border-line bg-white p-4 shadow-edge">
          <p className="m-0 text-center text-[17px] font-extrabold leading-tight">
            Would you like people to support this Delulu?
          </p>
          <p className="label-mono m-0 mt-1.5 text-center text-[10px] text-muted-foreground">
            Supporters send G$ straight to you
          </p>
          <div className="mt-4 flex flex-col gap-2">
            <GameButton full variant="green" onClick={makePublic} disabled={choice === "public"}>
              <Globe2 className="h-4 w-4" strokeWidth={2.4} />
              {choice === "public" ? "It's public!" : "Make it public"}
            </GameButton>
            <GameButton full variant="line" onClick={onDone} disabled={choice === "public"}>
              <Lock className="h-4 w-4" strokeWidth={2.4} /> Keep it private
            </GameButton>
          </div>
        </div>
      ) : (
        <GameButton full className="mt-4" onClick={onDone}>
          Done
        </GameButton>
      )}
    </ResponsiveSheet>
  );
}

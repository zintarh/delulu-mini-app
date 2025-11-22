"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, X } from "lucide-react";

interface ChickenOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  stakeAmount?: number;
}

export function ChickenOutModal({
  isOpen,
  onClose,
  onConfirm,
  stakeAmount = 100,
}: ChickenOutModalProps) {
  const earlyWithdrawFee = 5;
  const penaltyAmount = (stakeAmount * earlyWithdrawFee) / 100;
  const receiveAmount = stakeAmount - penaltyAmount;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-6">
      <Card className="w-full max-w-md bg-card border border-destructive/30 p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-6 h-6 text-destructive" />
            </div>
            <h2 className="font-black text-xl text-destructive">
              Withdraw Early?
            </h2>
          </div>
          <button
            className="h-8 w-8 -mr-2 -mt-2 hover:opacity-70 transition-opacity"
            onClick={onClose}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <p className="text-sm text-muted-foreground mb-6 font-medium">
          Early withdrawal incurs a penalty fee.
        </p>

        <div className="bg-destructive/5 rounded-xl p-4 mb-6 border border-destructive/20">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-bold">Penalty</span>
            <span className="font-black text-3xl text-destructive">
              {earlyWithdrawFee}%
            </span>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Stake</span>
              <span className="font-bold">${stakeAmount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground font-medium">Fee</span>
              <span className="font-bold text-destructive">
                -${penaltyAmount}
              </span>
            </div>
            <div className="h-px bg-border my-2" />
            <div className="flex justify-between">
              <span className="font-bold">Receive</span>
              <span className="font-black text-lg text-delulu-green">
                ${receiveAmount}
              </span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <Button
            size="lg"
            variant="destructive"
            className="w-full h-12 font-black rounded-xl"
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            <AlertTriangle className="w-5 h-5 mr-2" />
            Confirm
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="w-full h-12 font-bold rounded-xl border border-border bg-transparent"
            onClick={onClose}
          >
            Cancel
          </Button>
        </div>
      </Card>
    </div>
  );
}

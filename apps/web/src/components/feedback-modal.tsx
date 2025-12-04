"use client";

import { CheckCircle, XCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface FeedbackModalProps {
  isOpen: boolean;
  type: "success" | "error";
  title: string;
  message: string;
  onClose: () => void;
  actionText?: string;
}

export function FeedbackModal({
  isOpen,
  type,
  title,
  message,
  onClose,
  actionText = "Close"
}: FeedbackModalProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="bottom" className="bg-delulu-yellow rounded-t-3xl pb-8">
        <SheetHeader>
          <div className="flex justify-center mb-6">
            {type === "success" ? (
              <div className="w-20 h-20 rounded-full bg-delulu-green/10 flex items-center justify-center">
                <CheckCircle className="w-12 h-12 text-delulu-green" />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-red-100 flex items-center justify-center">
                <XCircle className="w-12 h-12 text-red-500" />
              </div>
            )}
          </div>
          <SheetTitle className="text-2xl font-bold text-delulu-dark text-center font-gloria">
            {title}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Message */}
          <p className="text-delulu-dark/70 text-center leading-relaxed">
            {message}
          </p>

          {/* Action Button */}
          <button
            onClick={onClose}
            className="w-full h-14 rounded-full bg-delulu-dark hover:bg-delulu-dark/90 text-white font-bold text-lg transition-all"
          >
            {actionText}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}


"use client";

import { CheckCircle, XCircle } from "lucide-react";
import { ResponsiveSheet } from "@/components/ui/responsive-sheet";
import { ModalHeader, ModalTitle } from "@/components/ui/modal";

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
    <ResponsiveSheet
      open={isOpen}
      onOpenChange={onClose}
      title={title}
      sheetClassName="bg-white rounded-t-3xl pb-8 [&>button]:text-gray-500 [&>button]:bg-gray-100 [&>button]:hover:bg-gray-200"
      modalClassName="max-w-md"
    >
      <div className="flex justify-center mb-6 lg:mb-4">
        {type === "success" ? (
          <div className="w-20 h-20 rounded-full bg-delulu-green/10 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-delulu-green" />
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
            <XCircle className="w-12 h-12 text-red-500" />
          </div>
        )}
      </div>
      <div className="mt-6 space-y-6 lg:mt-4">
          {/* Message */}
          <p className="text-gray-600 text-center leading-relaxed">
            {message}
          </p>

          {/* Action Button */}
          <button
            onClick={onClose}
            className="w-full h-14 rounded-md bg-delulu-yellow-reserved hover:bg-delulu-yellow-reserved/90 text-delulu-charcoal font-bold text-lg transition-all border-2 border-delulu-charcoal shadow-[3px_3px_0px_0px_#1A1A1A]"
          >
            {actionText}
          </button>
      </div>
    </ResponsiveSheet>
  );
}

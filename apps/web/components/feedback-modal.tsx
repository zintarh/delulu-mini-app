"use client";

import { CheckCircle, XCircle, X } from "lucide-react";

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
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center p-6 animate-fade-in">
      <div className="bg-white rounded-[32px] p-8 max-w-md w-full shadow-2xl animate-slide-up relative">
        {/* Close button - top right */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 rounded-full hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5 text-delulu-dark" />
        </button>

        {/* Icon */}
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

        {/* Title */}
        <h2 className="text-2xl font-bold text-delulu-dark text-center mb-3 font-schoolbell">
          {title}
        </h2>

        {/* Message */}
        <p className="text-delulu-dark/70 text-center mb-8 leading-relaxed">
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
    </div>
  );
}


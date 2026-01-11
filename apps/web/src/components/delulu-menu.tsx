"use client";

import { useState, useRef, useEffect } from "react";
import { MoreVertical, X, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { FormattedDelulu } from "@/hooks/use-delulus";

interface DeluluMenuProps {
  delulu: FormattedDelulu;
  onCancel?: () => void;
  onResolve?: () => void;
}

export function DeluluMenu({ delulu, onCancel, onResolve }: DeluluMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  const handleCancel = () => {
    setIsOpen(false);
    onCancel?.();
  };

  const handleResolve = () => {
    setIsOpen(false);
    onResolve?.();
  };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="p-1.5 rounded-full hover:bg-black/80 transition-colors"
        aria-label="More options"
      >
        <MoreVertical className="w-4 h-4 text-white/60" />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 w-40 bg-black border border-white/10 rounded-xl shadow-lg overflow-hidden z-50">
          {!delulu.isCancelled && !delulu.isResolved && (
            <>
              <button
                onClick={handleCancel}
                className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-black transition-colors"
              >
                <X className="w-4 h-4 text-red-400" />
                <span className="text-sm text-red-400 font-medium">Cancel</span>
              </button>
              <button
                onClick={handleResolve}
                className="w-full px-4 py-2.5 flex items-center gap-2 text-left hover:bg-black transition-colors border-t border-white/10"
              >
                <CheckCircle className="w-4 h-4 text-white/60" />
                <span className="text-sm text-white font-medium">Resolve</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}


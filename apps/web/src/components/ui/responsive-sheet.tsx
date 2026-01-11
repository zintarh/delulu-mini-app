"use client";

import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetTitle } from "./sheet";
import { Modal, ModalContent, ModalHeader, ModalTitle } from "./modal";
import { cn } from "@/lib/utils";

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showClose?: boolean;
  sheetClassName?: string;
  modalClassName?: string;
}

export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  children,
  className,
  contentClassName,
  sheetClassName,
  modalClassName,
  showClose = true,
}: ResponsiveSheetProps) {
  const [isMobile, setIsMobile] = useState(true);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };

    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  if (isMobile) {
    // Mobile: Use bottom sheet
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn("bg-white border-t border-gray-200", sheetClassName, contentClassName)}
        >
          {title && <SheetTitle className="sr-only">{title}</SheetTitle>}
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  // Desktop: Use modal
  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        className={cn("max-w-md bg-white", modalClassName, contentClassName)}
        showClose={showClose}
      >
        {title && (
          <ModalHeader>
            <ModalTitle className="text-delulu-charcoal">{title}</ModalTitle>
          </ModalHeader>
        )}
        {children}
      </ModalContent>
    </Modal>
  );
}

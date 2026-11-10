"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, bottomSheetShellClassName } from "./sheet";
import { Modal, ModalClose, ModalContent, ModalTitle } from "./modal";
import { cn } from "@/lib/utils";

interface ResponsiveSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  /** When true the title is sr-only everywhere — the caller renders its own visible heading */
  hideTitleVisually?: boolean;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  showClose?: boolean;
  sheetClassName?: string;
  modalClassName?: string;
}

const DESKTOP_QUERY = "(min-width: 1024px)"; // lg — matches the desktop sidebar

/**
 * Read synchronously on first render so a sheet that mounts already open
 * doesn't flash as a bottom sheet for a frame before switching to the modal.
 */
function useIsDesktop() {
  const [isDesktop, setIsDesktop] = useState(
    () => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches,
  );
  useEffect(() => {
    const mq = window.matchMedia(DESKTOP_QUERY);
    const sync = () => setIsDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return isDesktop;
}

/**
 * Bottom sheet on mobile (unchanged); on desktop a centred dialog in the
 * redesign's card style — 2px line border, chunky edge shadow, game-style
 * close button — rather than a stretched mobile sheet.
 */
export function ResponsiveSheet({
  open,
  onOpenChange,
  title,
  hideTitleVisually = false,
  children,
  className,
  contentClassName,
  sheetClassName,
  modalClassName,
  showClose = true,
}: ResponsiveSheetProps) {
  const isDesktop = useIsDesktop();

  if (!isDesktop) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className={cn(bottomSheetShellClassName, sheetClassName, contentClassName)}
        >
          {title && <SheetTitle className="sr-only">{title}</SheetTitle>}
          {children}
        </SheetContent>
      </Sheet>
    );
  }

  const visibleTitle = title && !hideTitleVisually;

  return (
    <Modal open={open} onOpenChange={onOpenChange}>
      <ModalContent
        showClose={false}
        overlayClassName="bg-ink/50 backdrop-blur-[3px]"
        className={cn(
          "w-[calc(100%-3rem)] max-w-[480px] max-h-[86vh] overflow-y-auto scrollbar-hide",
          "rounded-[28px] border-2 border-line bg-white p-7 text-ink",
          "shadow-[0_8px_0_#e6e6e0,0_32px_64px_-24px_rgba(22,22,21,0.45)]",
          modalClassName,
          contentClassName,
        )}
      >
        {title && (
          <ModalTitle
            className={cn(
              visibleTitle
                ? "mb-5 pr-14 text-[22px] font-extrabold leading-tight tracking-[-0.01em] text-ink"
                : "sr-only",
            )}
          >
            {title}
          </ModalTitle>
        )}
        {children}
        {showClose && (
          <ModalClose
            className="press-edge absolute right-5 top-5 z-10 flex h-10 w-10 items-center justify-center rounded-full border-2 border-line bg-white text-ink shadow-edge-sm hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink"
            aria-label="Close"
          >
            <X className="h-4 w-4" strokeWidth={3} />
          </ModalClose>
        )}
      </ModalContent>
    </Modal>
  );
}

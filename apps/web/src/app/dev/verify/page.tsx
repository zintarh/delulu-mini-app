"use client";

import { useEffect } from "react";
import { notFound } from "next/navigation";
import { RightPanelProvider, useVerifySheet } from "@/contexts/right-panel-context";
import { VerifySheet } from "@/components/verify-sheet";

function OpenOnMount() {
  const { open } = useVerifySheet();
  useEffect(() => open(), [open]);
  return null;
}

/** Development-only: the verify sheet, for layout checks. */
export default function DevVerifyPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return (
    <RightPanelProvider>
      <div className="h-[100dvh] bg-paper" />
      <OpenOnMount />
      <VerifySheet />
    </RightPanelProvider>
  );
}

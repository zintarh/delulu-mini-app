"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { useIdentity } from "@/hooks/identityHook";

const IdentityModal = dynamic(
  () => import("@/components/identity-modal").then((m) => m.IdentityModal),
  { ssr: false },
);

export default function IdentityFlow({
  open,
  onOpenChange,
  onVerified,
  inline = false,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onVerified: () => void;
  /** Plain inline block instead of a fixed-overlay modal — see IdentityModal. */
  inline?: boolean;
}) {
  const { status, isVerified, isLapsed, fvLink, setIsVerifying, generateLink, isGeneratingLink } =
    useIdentity();

  // Keep hook-driven verifying state in sync with our open prop.
  useEffect(() => {
    setIsVerifying(open);
  }, [open, setIsVerifying]);

  useEffect(() => {
    if (open && isVerified) {
      onVerified();
      onOpenChange(false);
    }
  }, [open, isVerified, onVerified, onOpenChange]);

  return (
    <IdentityModal
      isOpen={open}
      onClose={() => onOpenChange(false)}
      fvLink={fvLink}
      status={status}
      isLapsed={isLapsed}
      onRegenerate={generateLink}
      isGeneratingLink={isGeneratingLink}
      inline={inline}
    />
  );
}
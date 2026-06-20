"use client";

import dynamic from "next/dynamic";
import { RightPanelProvider } from "@/contexts/right-panel-context";

const ClaimPanel = dynamic(
  () => import("@/components/claim-panel").then((m) => m.ClaimPanel),
  { ssr: false },
);

const NotificationsPanel = dynamic(
  () =>
    import("@/components/notifications-panel").then(
      (m) => m.NotificationsPanel,
    ),
  { ssr: false },
);

/** Campaigns live outside (main) but reuse nav chrome that needs panel context. */
export default function CampaignsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RightPanelProvider>
      <NotificationsPanel />
      <ClaimPanel />
      {children}
    </RightPanelProvider>
  );
}

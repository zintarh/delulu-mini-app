"use client";

import FrameWalletProvider from "@/app/contexts/frame-wallet-context";
import { MiniAppProvider } from "@/app/contexts/miniapp-context";
import dynamic from "next/dynamic";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErudaProvider>
      <FrameWalletProvider>
        <MiniAppProvider addMiniAppOnLoad={true}>{children}</MiniAppProvider>
      </FrameWalletProvider>
    </ErudaProvider>
  );
}

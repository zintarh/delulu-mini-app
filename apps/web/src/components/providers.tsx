"use client";
import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ApolloProvider } from "@/components/providers/ApolloProvider";
import dynamic from "next/dynamic";
import { ThemeProvider } from "@/contexts/theme-context";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

export default function Providers({ children }: { children: React.ReactNode }) {

  return (
    <ErudaProvider>
      <ThemeProvider>
        <FrameWalletProvider>
          <ApolloProvider>
            <QueryProvider>
              <MiniAppProvider addMiniAppOnLoad={true}>
                {children}
              </MiniAppProvider>
            </QueryProvider>
          </ApolloProvider>
        </FrameWalletProvider>
      </ThemeProvider>
    </ErudaProvider>
  );
}

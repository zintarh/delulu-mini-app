"use client";
import { MiniAppProvider } from "@/contexts/miniapp-context";
import FrameWalletProvider from "@/contexts/frame-wallet-context";
import { QueryProvider } from "@/components/providers/QueryProvider";
import { ApolloProvider } from "@/components/providers/ApolloProvider";
import dynamic from "next/dynamic";
import { ThemeProvider, useTheme } from "@/contexts/theme-context";
import { PrivyProvider } from "@privy-io/react-auth";

const ErudaProvider = dynamic(
  () => import("../components/Eruda").then((c) => c.ErudaProvider),
  { ssr: false }
);

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

function AppWithPrivy({ children }: { children: React.ReactNode }) {
  const { theme } = useTheme();

  const appTree = (
    <FrameWalletProvider>
      <ApolloProvider>
        <QueryProvider>
          <MiniAppProvider addMiniAppOnLoad={true}>
            {children}
          </MiniAppProvider>
        </QueryProvider>
      </ApolloProvider>
    </FrameWalletProvider>
  );

  if (!privyAppId) {
    return appTree;
  }

  const isDark = theme === "dark";

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: isDark ? "#151515" : "#ffffff",
          accentColor: isDark ? "#F7F23D" : "#151515",
          logo: "/favicon_io/favicon-32x32.png",
          walletChainType: "ethereum-only",
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
        },
      }}
    >
      {appTree}
    </PrivyProvider>
  );
}

export default function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ErudaProvider>
      <ThemeProvider>
        <AppWithPrivy>{children}</AppWithPrivy>
      </ThemeProvider>
    </ErudaProvider>
  );
}

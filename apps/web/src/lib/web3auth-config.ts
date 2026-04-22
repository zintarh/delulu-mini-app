import type { Web3AuthContextConfig } from "@web3auth/modal/react";
import { WEB3AUTH_NETWORK } from "@web3auth/modal";

const HIDDEN = { showOnModal: false } as const;

export const web3AuthContextConfig: Web3AuthContextConfig = {
  web3AuthOptions: {
    clientId: process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!,
    web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_MAINNET,
    chains: [
      {
        chainNamespace: "eip155",
        chainId: "0xa4ec",
        rpcTarget:
          process.env.NEXT_PUBLIC_CELO_RPC_URL ?? "https://forno.celo.org",
        displayName: "Celo Mainnet",
        ticker: "CELO",
        tickerName: "Celo",
        blockExplorerUrl: "https://celoscan.io",
        logo: "https://cryptologos.cc/logos/celo-celo-logo.png",
      },
    ],
    defaultChainId: "0xa4ec",
    modalConfig: {
      connectors: {
        auth: {
          label: "auth",
          loginMethods: {
            google:    HIDDEN,
            twitter:   HIDDEN,
            facebook:  HIDDEN,
            discord:   HIDDEN,
            apple:     HIDDEN,
            github:    HIDDEN,
            reddit:    HIDDEN,
            twitch:    HIDDEN,
            linkedin:  HIDDEN,
            line:      HIDDEN,
            kakao:     HIDDEN,
            wechat:    HIDDEN,
            telegram:  HIDDEN,
            farcaster: HIDDEN,
          },
        },
      },
    },
  },
};

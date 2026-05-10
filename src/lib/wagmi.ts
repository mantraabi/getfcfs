"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { mainnet } from "wagmi/chains";
import { http } from "viem";

const ALCHEMY_KEY = process.env.NEXT_PUBLIC_ALCHEMY_API_KEY || "";
const WC_PROJECT_ID =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "getfcfs";

const alchemyUrl = ALCHEMY_KEY
  ? `https://eth-mainnet.g.alchemy.com/v2/${ALCHEMY_KEY}`
  : "https://cloudflare-eth.com";

export const wagmiConfig = getDefaultConfig({
  appName: "GetFCFS",
  projectId: WC_PROJECT_ID,
  chains: [mainnet],
  transports: {
    [mainnet.id]: http(alchemyUrl, {
      batch: true,
      // fail fast so auto-mint loop can retry quickly
      timeout: 8_000,
      retryCount: 2,
      retryDelay: 150,
    }),
  },
  ssr: true,
});

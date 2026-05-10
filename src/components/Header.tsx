"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function Header() {
  return (
    <header className="relative z-10 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/20 border border-accent/40">
            <span className="text-lg">⚡</span>
          </div>
          <div>
            <h1 className="text-lg font-semibold tracking-tight">GetFCFS</h1>
            <p className="text-xs text-zinc-500">NFT mint dashboard · Ethereum mainnet</p>
          </div>
        </div>
        <ConnectButton
          chainStatus="icon"
          showBalance={{ smallScreen: false, largeScreen: true }}
        />
      </div>
    </header>
  );
}

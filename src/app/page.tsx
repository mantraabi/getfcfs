"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { formatEther } from "viem";

import { Header } from "@/components/Header";
import { ContractLoader } from "@/components/ContractLoader";
import { CollectionInfo } from "@/components/CollectionInfo";
import { MintConfigPanel } from "@/components/MintConfigPanel";
import { MintExecutor } from "@/components/MintExecutor";
import type { LoadedContract, MintConfig } from "@/lib/types";
import { detectFunctions, type MintFunction } from "@/lib/abi";

const defaultConfig: MintConfig = {
  selectedFunctionName: null,
  quantity: 1,
  priceEthPerUnit: "",
  recipient: "",
  gasPreset: "fast",
  priorityFeeGwei: "",
  maxFeeGwei: "",
  useCustomGas: false,
};

export default function Page() {
  const { isConnected } = useAccount();
  const [contract, setContract] = useState<LoadedContract | null>(null);
  const [config, setConfig] = useState<MintConfig>(defaultConfig);

  function handleLoaded(c: LoadedContract) {
    setContract(c);

    // auto-pick the most likely mint function (first in the sorted list)
    const firstFn: MintFunction | undefined = detectFunctions(c.abi)
      .mintFunctions[0];

    setConfig({
      ...defaultConfig,
      selectedFunctionName: firstFn?.name ?? null,
      priceEthPerUnit:
        c.onchainPrice !== undefined ? formatEther(c.onchainPrice) : "",
    });
  }

  function handleReset() {
    setContract(null);
    setConfig(defaultConfig);
  }

  function patchConfig(patch: Partial<MintConfig>) {
    setConfig((c) => ({ ...c, ...patch }));
  }

  function handleSelectFunction(fn: MintFunction) {
    setConfig((c) => ({ ...c, selectedFunctionName: fn.name }));
  }

  return (
    <div className="relative min-h-screen">
      <Header />

      <main className="relative z-10 mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight">
            FCFS Mint Dashboard
          </h2>
          <p className="mt-1 text-sm text-zinc-400">
            Paste an NFT contract, configure quantity and gas, and fire a
            manual or auto-mint the moment the sale goes live.
          </p>
        </div>

        {!isConnected ? (
          <div className="card mb-4 flex items-center gap-3 border-warning/40 bg-warning/5">
            <span className="h-2 w-2 rounded-full bg-warning animate-pulse" />
            <p className="text-sm text-warning">
              Connect a wallet to load contracts and submit mint transactions.
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-1 gap-4">
          <ContractLoader
            onLoaded={handleLoaded}
            loadedAddress={contract?.address ?? null}
            onReset={handleReset}
          />

          {contract ? (
            <>
              <CollectionInfo contract={contract} />
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
                <div className="lg:col-span-3">
                  <MintConfigPanel
                    contract={contract}
                    config={config}
                    onChange={patchConfig}
                    onSelectFunction={handleSelectFunction}
                  />
                </div>
                <div className="lg:col-span-2">
                  <MintExecutor contract={contract} config={config} />
                </div>
              </div>
            </>
          ) : (
            <div className="card border-dashed text-sm text-zinc-500">
              Load a contract to continue.
            </div>
          )}
        </div>

        <footer className="mt-10 border-t border-border pt-4 text-center text-xs text-zinc-600">
          Built with Next.js · Wagmi · RainbowKit · Viem. Use at your own risk.
          Never share your seed phrase.
        </footer>
      </main>
    </div>
  );
}

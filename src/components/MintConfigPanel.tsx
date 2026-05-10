"use client";

import { useMemo } from "react";
import { formatEther } from "viem";

import { detectFunctions, type MintFunction } from "@/lib/abi";
import type { LoadedContract, MintConfig } from "@/lib/types";
import { MintFunctionPicker } from "./MintFunctionPicker";
import { GasSettings } from "./GasSettings";

interface Props {
  contract: LoadedContract;
  config: MintConfig;
  onChange: (patch: Partial<MintConfig>) => void;
  onSelectFunction: (fn: MintFunction) => void;
}

export function MintConfigPanel({
  contract,
  config,
  onChange,
  onSelectFunction,
}: Props) {
  const detected = useMemo(() => detectFunctions(contract.abi), [contract.abi]);
  const totalCostEth = useMemo(() => {
    const price = parseFloat(config.priceEthPerUnit);
    if (!Number.isFinite(price)) return 0;
    return price * config.quantity;
  }, [config.priceEthPerUnit, config.quantity]);

  return (
    <section className="card">
      <h2 className="mb-1 text-base font-semibold">2. Mint configuration</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Pick the mint function, set quantity & price, and choose a gas preset.
      </p>

      <div className="space-y-5">
        <MintFunctionPicker
          detected={detected}
          selectedName={config.selectedFunctionName}
          onSelect={onSelectFunction}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="label">Quantity</label>
            <input
              className="input"
              type="number"
              min={1}
              value={config.quantity}
              onChange={(e) =>
                onChange({
                  quantity: Math.max(1, parseInt(e.target.value || "1", 10)),
                })
              }
            />
          </div>
          <div>
            <label className="label flex items-center justify-between">
              <span>Price per NFT (ETH)</span>
              {contract.onchainPrice !== undefined ? (
                <button
                  type="button"
                  onClick={() =>
                    onChange({
                      priceEthPerUnit: formatEther(contract.onchainPrice!),
                    })
                  }
                  className="text-[10px] text-accent hover:underline normal-case"
                >
                  use on-chain
                </button>
              ) : null}
            </label>
            <input
              className="input"
              value={config.priceEthPerUnit}
              onChange={(e) => onChange({ priceEthPerUnit: e.target.value })}
              placeholder="0.0"
              inputMode="decimal"
            />
          </div>
        </div>

        <div>
          <label className="label">Recipient (optional)</label>
          <input
            className="input"
            value={config.recipient}
            onChange={(e) => onChange({ recipient: e.target.value })}
            placeholder="Defaults to your connected wallet"
            spellCheck={false}
          />
        </div>

        <GasSettings config={config} onChange={onChange} />

        <div className="rounded-md border border-border bg-black/30 px-3 py-2 text-sm">
          <span className="text-zinc-400">Total value sent: </span>
          <span className="font-mono text-zinc-100">
            {totalCostEth.toString()} ETH
          </span>
        </div>
      </div>
    </section>
  );
}

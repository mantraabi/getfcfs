"use client";

import { useEffect, useState } from "react";
import { useConfig } from "wagmi";
import { getPublicClient } from "@wagmi/core";
import { mainnet } from "wagmi/chains";

import { GAS_PRESETS, computeGasFees, weiToGwei } from "@/lib/gas";
import type { GasPreset, MintConfig } from "@/lib/types";

interface Props {
  config: MintConfig;
  onChange: (patch: Partial<MintConfig>) => void;
}

export function GasSettings({ config, onChange }: Props) {
  const wagmi = useConfig();
  const [baseFeeWei, setBaseFeeWei] = useState<bigint | null>(null);

  // refresh the current baseFee every 12s
  useEffect(() => {
    const client = getPublicClient(wagmi, { chainId: mainnet.id });
    if (!client) return;

    let cancelled = false;

    async function tick() {
      try {
        const block = await client!.getBlock({ blockTag: "latest" });
        if (!cancelled && block.baseFeePerGas) {
          setBaseFeeWei(block.baseFeePerGas);
        }
      } catch {
        /* ignore */
      }
    }
    tick();
    const id = setInterval(tick, 12_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [wagmi]);

  const preview =
    baseFeeWei !== null
      ? computeGasFees(baseFeeWei, config.gasPreset)
      : null;

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <label className="label mb-0">Gas preset</label>
        <span className="text-xs text-zinc-500 font-mono">
          {baseFeeWei
            ? `base ${weiToGwei(baseFeeWei)} gwei`
            : "base … gwei"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {(Object.keys(GAS_PRESETS) as GasPreset[]).map((key) => {
          const preset = GAS_PRESETS[key];
          const selected = config.gasPreset === key && !config.useCustomGas;
          return (
            <button
              key={key}
              type="button"
              onClick={() =>
                onChange({ gasPreset: key, useCustomGas: false })
              }
              className={`rounded-md border px-3 py-2 text-left transition-colors ${
                selected
                  ? "border-accent bg-accent/10"
                  : "border-border bg-black/30 hover:border-accent/60"
              }`}
            >
              <div className="text-sm font-medium">{preset.label}</div>
              <div className="mt-0.5 text-[10px] text-zinc-500">
                ×{preset.maxFeeMultiplier} base + {preset.priorityFeeGwei} gwei tip
              </div>
            </button>
          );
        })}
      </div>

      <p className="mt-2 text-[11px] text-zinc-500">
        {GAS_PRESETS[config.gasPreset].description}
      </p>

      {preview ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 rounded-md border border-border bg-black/30 px-3 py-2 text-xs font-mono text-zinc-400">
          <span>
            maxFee:{" "}
            <span className="text-zinc-200">
              {weiToGwei(preview.maxFeePerGas)} gwei
            </span>
          </span>
          <span>
            priorityFee:{" "}
            <span className="text-zinc-200">
              {weiToGwei(preview.maxPriorityFeePerGas)} gwei
            </span>
          </span>
        </div>
      ) : null}

      <label className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
        <input
          type="checkbox"
          checked={config.useCustomGas}
          onChange={(e) => onChange({ useCustomGas: e.target.checked })}
          className="h-3.5 w-3.5 rounded border-border bg-black/40 accent-accent"
        />
        Override with custom gas
      </label>

      {config.useCustomGas ? (
        <div className="mt-2 grid grid-cols-2 gap-2">
          <div>
            <label className="label">Max fee (gwei)</label>
            <input
              className="input"
              value={config.maxFeeGwei}
              onChange={(e) => onChange({ maxFeeGwei: e.target.value })}
              placeholder="e.g. 50"
              inputMode="decimal"
            />
          </div>
          <div>
            <label className="label">Priority fee (gwei)</label>
            <input
              className="input"
              value={config.priorityFeeGwei}
              onChange={(e) => onChange({ priorityFeeGwei: e.target.value })}
              placeholder="e.g. 3"
              inputMode="decimal"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

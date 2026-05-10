"use client";

import {
  formatFunctionSignature,
  type DetectedFunctions,
  type MintFunction,
} from "@/lib/abi";

interface Props {
  detected: DetectedFunctions;
  selectedName: string | null;
  onSelect: (fn: MintFunction) => void;
}

export function MintFunctionPicker({ detected, selectedName, onSelect }: Props) {
  const { mintFunctions } = detected;

  return (
    <div>
      <label className="label">Mint function</label>
      <div className="flex flex-col gap-2">
        {mintFunctions.map((fn, idx) => {
          const selected = fn.name === selectedName;
          return (
            <button
              key={`${fn.name}-${idx}`}
              type="button"
              onClick={() => onSelect(fn)}
              className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs font-mono transition-colors ${
                selected
                  ? "border-accent bg-accent/10 text-white"
                  : "border-border bg-black/30 text-zinc-300 hover:border-accent/60"
              }`}
            >
              <span className="truncate">{formatFunctionSignature(fn)}</span>
              {fn.stateMutability === "payable" ? (
                <span className="ml-2 shrink-0 rounded bg-warning/20 px-1.5 py-0.5 text-[10px] uppercase text-warning">
                  payable
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

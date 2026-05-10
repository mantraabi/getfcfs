import type { GasPreset } from "./types";

/**
 * Multipliers applied on top of the current network baseFee + priorityFee.
 * Tuned for FCFS mints — aggressive > fast > normal > slow.
 */
export const GAS_PRESETS: Record<
  GasPreset,
  {
    label: string;
    description: string;
    maxFeeMultiplier: number; // applied to baseFee
    priorityFeeGwei: number;
  }
> = {
  slow: {
    label: "Slow",
    description: "Cheapest. Use only when the network is quiet.",
    maxFeeMultiplier: 1.1,
    priorityFeeGwei: 0.5,
  },
  normal: {
    label: "Normal",
    description: "Balanced. Good for regular public mints.",
    maxFeeMultiplier: 1.5,
    priorityFeeGwei: 1.5,
  },
  fast: {
    label: "Fast",
    description: "Priority inclusion. Recommended for FCFS mints.",
    maxFeeMultiplier: 2,
    priorityFeeGwei: 3,
  },
  aggressive: {
    label: "Aggressive",
    description: "Max priority. Expensive, but wins gas wars.",
    maxFeeMultiplier: 3,
    priorityFeeGwei: 8,
  },
};

/**
 * Given a baseFee and a preset, compute EIP-1559 gas fees in wei.
 * @param baseFeeWei current block's baseFeePerGas
 */
export function computeGasFees(
  baseFeeWei: bigint,
  preset: GasPreset,
): { maxFeePerGas: bigint; maxPriorityFeePerGas: bigint } {
  const { maxFeeMultiplier, priorityFeeGwei } = GAS_PRESETS[preset];

  // multiply bigint by float via scaled integer math (×1000)
  const scale = 1000n;
  const multiplier = BigInt(Math.round(maxFeeMultiplier * 1000));
  const maxFeePerGasFromBase = (baseFeeWei * multiplier) / scale;

  const priorityWei = BigInt(Math.round(priorityFeeGwei * 1e9));

  // maxFeePerGas must always be >= maxPriorityFeePerGas
  const maxFeePerGas =
    maxFeePerGasFromBase > priorityWei
      ? maxFeePerGasFromBase + priorityWei
      : priorityWei * 2n;

  return { maxFeePerGas, maxPriorityFeePerGas: priorityWei };
}

export function weiToGwei(wei: bigint): string {
  const gwei = Number(wei) / 1e9;
  if (gwei >= 100) return gwei.toFixed(0);
  if (gwei >= 10) return gwei.toFixed(1);
  return gwei.toFixed(2);
}

export function gweiToWei(gwei: string | number): bigint {
  const n = typeof gwei === "string" ? parseFloat(gwei) : gwei;
  if (!Number.isFinite(n) || n < 0) return 0n;
  return BigInt(Math.round(n * 1e9));
}

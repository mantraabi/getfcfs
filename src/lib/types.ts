import type { Abi } from "viem";
import type { MintFunction } from "./abi";

export interface LoadedContract {
  address: `0x${string}`;
  contractName: string | null;
  isProxy: boolean;
  implementationAddress: string | null;
  abi: Abi;
  name?: string;
  symbol?: string;
  totalSupply?: bigint;
  maxSupply?: bigint;
  onchainPrice?: bigint;
  saleActive?: boolean;
  saleCheckFnName?: string;
  /** if true, sale active value was read; if false, we couldn't find a sale-status fn */
  saleCheckSupported: boolean;
}

export type GasPreset = "slow" | "normal" | "fast" | "aggressive";

export interface MintConfig {
  selectedFunctionName: string | null;
  quantity: number;
  priceEthPerUnit: string; // ETH string, e.g. "0.05"
  recipient: string; // optional override, default = connected address
  gasPreset: GasPreset;
  priorityFeeGwei: string; // custom priority fee override (optional)
  maxFeeGwei: string; // custom max fee override (optional)
  useCustomGas: boolean;
}

export type MintMode = "idle" | "manual" | "auto";

export interface AutoMintState {
  running: boolean;
  attempts: number;
  lastError: string | null;
  lastTxHash: string | null;
  lastCheckedAt: number | null;
}

export type { MintFunction };

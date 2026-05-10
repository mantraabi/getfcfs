import { isAddress, parseEther, type AbiFunction } from "viem";

import { findQuantityInput, findRecipientInput } from "./abi";

export interface BuildMintArgsInput {
  fn: AbiFunction;
  quantity: number;
  account: `0x${string}`;
  recipientOverride?: string;
}

/**
 * Build a positional `args` array for a mint function, based on the heuristics
 * in abi.ts (quantity slot + recipient slot). Any other inputs get sensible
 * defaults so the call is at least well-formed.
 */
export function buildMintArgs({
  fn,
  quantity,
  account,
  recipientOverride,
}: BuildMintArgsInput): unknown[] {
  const qtyIdx = findQuantityInput(fn);
  const toIdx = findRecipientInput(fn);

  const recipient =
    recipientOverride && isAddress(recipientOverride.trim())
      ? (recipientOverride.trim() as `0x${string}`)
      : account;

  return fn.inputs.map((input, i) => {
    if (i === qtyIdx) return BigInt(quantity);
    if (i === toIdx) return recipient;
    // fallbacks for common trailing params
    if (input.type === "address") return recipient;
    if (input.type.startsWith("uint")) return 0n;
    if (input.type === "bool") return false;
    if (input.type === "bytes" || input.type.startsWith("bytes"))
      return "0x";
    if (input.type === "string") return "";
    if (input.type.endsWith("[]")) return [];
    return 0n;
  });
}

export function parsePriceEth(priceEth: string, quantity: number): bigint {
  if (!priceEth || priceEth.trim() === "") return 0n;
  try {
    const perUnit = parseEther(priceEth.trim() as `${number}`);
    return perUnit * BigInt(quantity);
  } catch {
    return 0n;
  }
}

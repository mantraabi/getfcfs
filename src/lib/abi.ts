import type { Abi, AbiFunction, AbiParameter } from "viem";

/**
 * Minimal ABI for any ERC721/ERC1155 collection read helpers.
 * Used before we have the real ABI, or to probe standard views.
 */
export const erc721ReadAbi = [
  {
    type: "function",
    name: "name",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "symbol",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "string" }],
  },
  {
    type: "function",
    name: "totalSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "maxSupply",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "MAX_SUPPLY",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "mintPrice",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "price",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "cost",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "PRICE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "uint256" }],
  },
  {
    type: "function",
    name: "publicSaleActive",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "saleIsActive",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "mintActive",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
  {
    type: "function",
    name: "paused",
    stateMutability: "view",
    inputs: [],
    outputs: [{ type: "bool" }],
  },
] as const;

// Known function names (lowercased) most commonly used for public mints.
const KNOWN_MINT_NAMES = [
  "mint",
  "publicmint",
  "mintpublic",
  "publicsalemint",
  "salemint",
  "claim",
  "publicclaim",
  "mintto",
  "mintnft",
  "mintnfts",
  "purchase",
  "buy",
  "batchmint",
];

const PRICE_FN_NAMES = [
  "mintprice",
  "price",
  "cost",
  "publicprice",
  "publicmintprice",
  "publicsaleprice",
];

const MAX_SUPPLY_NAMES = ["maxsupply", "max_supply", "maxtotalsupply"];

const SALE_STATUS_NAMES = [
  "publicsaleactive",
  "saleisactive",
  "mintactive",
  "ispublicsaleactive",
  "issaleactive",
  "ismintactive",
];

export type MintFunction = AbiFunction & { stateMutability: "payable" | "nonpayable" };

export interface DetectedFunctions {
  mintFunctions: MintFunction[];
  priceFunction: AbiFunction | null;
  maxSupplyFunction: AbiFunction | null;
  saleStatusFunction: AbiFunction | null;
}

/**
 * Heuristically detect a contract's mint-related functions from its ABI.
 */
export function detectFunctions(abi: Abi): DetectedFunctions {
  const fns = abi.filter((e): e is AbiFunction => e.type === "function");

  const isWriteable = (fn: AbiFunction) =>
    fn.stateMutability === "payable" || fn.stateMutability === "nonpayable";

  const mintFunctions = fns
    .filter(isWriteable)
    .filter((fn) => {
      const name = fn.name.toLowerCase();
      if (KNOWN_MINT_NAMES.includes(name)) return true;
      // anything that includes "mint" or "claim" is a candidate
      return /mint|claim|drop/i.test(fn.name);
    })
    .filter((fn) => {
      // require function to be either payable, or otherwise public-facing
      // exclude things clearly owner-only by name
      const name = fn.name.toLowerCase();
      if (
        name.includes("owner") ||
        name.includes("reserve") ||
        name.includes("airdrop") ||
        name.includes("admin") ||
        name.includes("team") ||
        name.includes("dev")
      ) {
        return false;
      }
      return true;
    })
    // sort by: payable first, fewer args first
    .sort((a, b) => {
      const aPayable = a.stateMutability === "payable" ? 0 : 1;
      const bPayable = b.stateMutability === "payable" ? 0 : 1;
      if (aPayable !== bPayable) return aPayable - bPayable;
      return a.inputs.length - b.inputs.length;
    }) as MintFunction[];

  const findView = (names: string[]) =>
    fns.find(
      (fn) =>
        (fn.stateMutability === "view" || fn.stateMutability === "pure") &&
        names.includes(fn.name.toLowerCase()) &&
        fn.inputs.length === 0,
    ) || null;

  return {
    mintFunctions,
    priceFunction: findView(PRICE_FN_NAMES),
    maxSupplyFunction: findView(MAX_SUPPLY_NAMES),
    saleStatusFunction: findView(SALE_STATUS_NAMES),
  };
}

/**
 * Build a human-readable signature for an ABI function:
 *   mint(uint256 quantity, address to)
 */
export function formatFunctionSignature(fn: AbiFunction): string {
  const args = fn.inputs
    .map((i: AbiParameter) => `${i.type}${i.name ? ` ${i.name}` : ""}`)
    .join(", ");
  const payable = fn.stateMutability === "payable" ? " payable" : "";
  return `${fn.name}(${args})${payable}`;
}

/**
 * Heuristically find a "quantity"-like argument on a mint function.
 */
export function findQuantityInput(fn: AbiFunction): number {
  const idx = fn.inputs.findIndex((i) => {
    const name = (i.name || "").toLowerCase();
    return (
      i.type.startsWith("uint") &&
      (name.includes("quantity") ||
        name.includes("amount") ||
        name.includes("count") ||
        name.includes("numberof") ||
        name === "qty" ||
        name === "num" ||
        name === "n" ||
        name === "_quantity" ||
        name === "_amount")
    );
  });
  if (idx !== -1) return idx;
  // fallback: first uint arg
  return fn.inputs.findIndex((i) => i.type.startsWith("uint"));
}

/**
 * Heuristically find a "recipient/to"-like argument on a mint function.
 */
export function findRecipientInput(fn: AbiFunction): number {
  return fn.inputs.findIndex((i) => {
    const name = (i.name || "").toLowerCase();
    return (
      i.type === "address" &&
      (name.includes("to") ||
        name.includes("recipient") ||
        name.includes("receiver") ||
        name === "account")
    );
  });
}

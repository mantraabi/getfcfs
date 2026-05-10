"use client";

import { useState } from "react";
import { isAddress, type Abi } from "viem";
import { useConfig } from "wagmi";
import { readContracts } from "@wagmi/core";
import toast from "react-hot-toast";

import { detectFunctions, erc721ReadAbi } from "@/lib/abi";
import type { LoadedContract } from "@/lib/types";

interface Props {
  onLoaded: (contract: LoadedContract) => void;
  loadedAddress?: string | null;
  onReset: () => void;
}

export function ContractLoader({ onLoaded, loadedAddress, onReset }: Props) {
  const config = useConfig();
  const [address, setAddress] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLoad() {
    const trimmed = address.trim();
    if (!isAddress(trimmed)) {
      toast.error("Invalid contract address");
      return;
    }

    setLoading(true);
    const toastId = toast.loading("Fetching ABI from Etherscan…");

    try {
      // 1) fetch ABI
      const res = await fetch(`/api/abi?address=${trimmed}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch ABI");
      }

      const abi = data.abi as Abi;
      const detected = detectFunctions(abi);

      if (detected.mintFunctions.length === 0) {
        toast.error("No mint-like function found in this contract", {
          id: toastId,
        });
        setLoading(false);
        return;
      }

      toast.loading("Reading collection info…", { id: toastId });

      // 2) read collection info via wagmi/core
      const results = await readContracts(config, {
        allowFailure: true,
        contracts: [
          { address: trimmed, abi: erc721ReadAbi, functionName: "name" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "symbol" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "totalSupply" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "maxSupply" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "MAX_SUPPLY" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "mintPrice" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "price" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "cost" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "PRICE" },
          {
            address: trimmed,
            abi: erc721ReadAbi,
            functionName: "publicSaleActive",
          },
          { address: trimmed, abi: erc721ReadAbi, functionName: "saleIsActive" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "mintActive" },
          { address: trimmed, abi: erc721ReadAbi, functionName: "paused" },
        ],
      });

      const pick = <T,>(idx: number): T | undefined =>
        results[idx]?.status === "success"
          ? (results[idx].result as T)
          : undefined;

      const name = pick<string>(0);
      const symbol = pick<string>(1);
      const totalSupply = pick<bigint>(2);
      const maxSupply = pick<bigint>(3) ?? pick<bigint>(4);
      const onchainPrice =
        pick<bigint>(5) ?? pick<bigint>(6) ?? pick<bigint>(7) ?? pick<bigint>(8);

      // sale active status
      let saleActive: boolean | undefined;
      let saleCheckFnName: string | undefined;
      let saleCheckSupported = false;
      const saleCandidates: Array<[number, string]> = [
        [9, "publicSaleActive"],
        [10, "saleIsActive"],
        [11, "mintActive"],
      ];
      for (const [idx, fnName] of saleCandidates) {
        const v = pick<boolean>(idx);
        if (typeof v === "boolean") {
          saleActive = v;
          saleCheckFnName = fnName;
          saleCheckSupported = true;
          break;
        }
      }
      // paused is inverted
      if (!saleCheckSupported) {
        const paused = pick<boolean>(12);
        if (typeof paused === "boolean") {
          saleActive = !paused;
          saleCheckFnName = "paused";
          saleCheckSupported = true;
        }
      }

      const contract: LoadedContract = {
        address: trimmed,
        contractName: data.contractName,
        isProxy: !!data.isProxy,
        implementationAddress: data.implementationAddress,
        abi,
        name,
        symbol,
        totalSupply,
        maxSupply,
        onchainPrice,
        saleActive,
        saleCheckFnName,
        saleCheckSupported,
      };

      onLoaded(contract);
      toast.success(
        `Loaded ${name || data.contractName || "contract"} · ${detected.mintFunctions.length} mint fn(s)`,
        { id: toastId },
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(message, { id: toastId });
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="card">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">1. Load NFT contract</h2>
          <p className="text-xs text-zinc-500">
            Paste a verified NFT contract address on Ethereum mainnet.
          </p>
        </div>
        {loadedAddress ? (
          <button onClick={onReset} className="btn-secondary text-xs">
            Reset
          </button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          className="input flex-1"
          placeholder="0x..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleLoad();
          }}
          disabled={loading}
          spellCheck={false}
          autoComplete="off"
        />
        <button
          onClick={handleLoad}
          disabled={loading || !address.trim()}
          className="btn-primary sm:w-32"
        >
          {loading ? "Loading…" : "Load"}
        </button>
      </div>
    </section>
  );
}

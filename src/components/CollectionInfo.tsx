"use client";

import { formatEther } from "viem";
import type { LoadedContract } from "@/lib/types";

interface Props {
  contract: LoadedContract;
}

function truncate(addr: string) {
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function CollectionInfo({ contract }: Props) {
  const {
    address,
    name,
    symbol,
    totalSupply,
    maxSupply,
    onchainPrice,
    saleActive,
    saleCheckSupported,
    saleCheckFnName,
    isProxy,
    implementationAddress,
  } = contract;

  const supplyText =
    totalSupply !== undefined
      ? `${totalSupply.toString()}${maxSupply !== undefined ? ` / ${maxSupply.toString()}` : ""}`
      : "unknown";

  const priceText =
    onchainPrice !== undefined ? `${formatEther(onchainPrice)} ETH` : "—";

  return (
    <section className="card">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold">
          {name || contract.contractName || "Untitled collection"}
          {symbol ? (
            <span className="ml-2 text-sm text-zinc-500">({symbol})</span>
          ) : null}
        </h2>
        {isProxy ? (
          <span className="pill text-zinc-300">
            <span className="h-1.5 w-1.5 rounded-full bg-warning" />
            Proxy
          </span>
        ) : null}
        {saleCheckSupported ? (
          <span className="pill">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                saleActive ? "bg-success" : "bg-danger"
              }`}
            />
            {saleActive ? "Sale live" : "Sale not live"}
            {saleCheckFnName ? (
              <span className="ml-1 text-zinc-500">· {saleCheckFnName}</span>
            ) : null}
          </span>
        ) : (
          <span className="pill text-zinc-400">
            <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
            Sale status unknown
          </span>
        )}
      </div>

      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-xs uppercase tracking-wider text-zinc-500">
            Contract
          </dt>
          <dd className="mt-1 font-mono text-xs">
            <a
              href={`https://etherscan.io/address/${address}`}
              target="_blank"
              rel="noreferrer"
              className="text-accent hover:underline"
            >
              {truncate(address)}
            </a>
          </dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-zinc-500">
            Supply
          </dt>
          <dd className="mt-1 font-mono">{supplyText}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-zinc-500">
            On-chain price
          </dt>
          <dd className="mt-1 font-mono">{priceText}</dd>
        </div>
        <div>
          <dt className="text-xs uppercase tracking-wider text-zinc-500">
            Implementation
          </dt>
          <dd className="mt-1 font-mono text-xs">
            {implementationAddress ? (
              <a
                href={`https://etherscan.io/address/${implementationAddress}`}
                target="_blank"
                rel="noreferrer"
                className="text-accent hover:underline"
              >
                {truncate(implementationAddress)}
              </a>
            ) : (
              "—"
            )}
          </dd>
        </div>
      </dl>
    </section>
  );
}

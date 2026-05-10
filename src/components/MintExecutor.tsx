"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAccount, useConfig } from "wagmi";
import {
  getPublicClient,
  readContract,
  writeContract,
  waitForTransactionReceipt,
} from "@wagmi/core";
import { mainnet } from "wagmi/chains";
import type { AbiFunction } from "viem";
import toast from "react-hot-toast";

import {
  detectFunctions,
  erc721ReadAbi,
  formatFunctionSignature,
} from "@/lib/abi";
import { computeGasFees, gweiToWei } from "@/lib/gas";
import { buildMintArgs, parsePriceEth } from "@/lib/mintArgs";
import type { AutoMintState, LoadedContract, MintConfig } from "@/lib/types";

interface Props {
  contract: LoadedContract;
  config: MintConfig;
}

const POLL_INTERVAL_MS = 2_000;

export function MintExecutor({ contract, config }: Props) {
  const { address: account, isConnected } = useAccount();
  const wagmi = useConfig();

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [autoState, setAutoState] = useState<AutoMintState>({
    running: false,
    attempts: 0,
    lastError: null,
    lastTxHash: null,
    lastCheckedAt: null,
  });

  // keep mutable refs so the polling loop always sees the latest values
  const configRef = useRef(config);
  const contractRef = useRef(contract);
  const runningRef = useRef(false);
  useEffect(() => {
    configRef.current = config;
  }, [config]);
  useEffect(() => {
    contractRef.current = contract;
  }, [contract]);

  const getSelectedFn = useCallback((): AbiFunction | null => {
    const { mintFunctions } = detectFunctions(contractRef.current.abi);
    const name = configRef.current.selectedFunctionName;
    return mintFunctions.find((f) => f.name === name) || null;
  }, []);

  // --- core mint call -----------------------------------------------------

  const submitMint = useCallback(async (): Promise<string> => {
    if (!account) throw new Error("Wallet not connected");
    const fn = getSelectedFn();
    if (!fn) throw new Error("No mint function selected");

    const cfg = configRef.current;
    const ctr = contractRef.current;

    const args = buildMintArgs({
      fn,
      quantity: cfg.quantity,
      account,
      recipientOverride: cfg.recipient,
    });

    const value =
      fn.stateMutability === "payable"
        ? parsePriceEth(cfg.priceEthPerUnit, cfg.quantity)
        : 0n;

    // compute gas
    let maxFeePerGas: bigint;
    let maxPriorityFeePerGas: bigint;

    if (cfg.useCustomGas) {
      maxPriorityFeePerGas = gweiToWei(cfg.priorityFeeGwei || "0");
      maxFeePerGas = gweiToWei(cfg.maxFeeGwei || "0");
      if (maxFeePerGas < maxPriorityFeePerGas) {
        maxFeePerGas = maxPriorityFeePerGas * 2n;
      }
    } else {
      const client = getPublicClient(wagmi, { chainId: mainnet.id });
      if (!client) throw new Error("RPC client unavailable");
      const block = await client.getBlock({ blockTag: "latest" });
      const baseFee = block.baseFeePerGas ?? 0n;
      const fees = computeGasFees(baseFee, cfg.gasPreset);
      maxFeePerGas = fees.maxFeePerGas;
      maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
    }

    const hash = await writeContract(wagmi, {
      address: ctr.address,
      abi: ctr.abi,
      functionName: fn.name,
      args,
      value,
      maxFeePerGas,
      maxPriorityFeePerGas,
      chainId: mainnet.id,
    });

    return hash;
  }, [account, getSelectedFn, wagmi]);

  // --- manual mint --------------------------------------------------------

  async function handleManualMint() {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!config.selectedFunctionName) {
      toast.error("Select a mint function");
      return;
    }

    setIsSubmitting(true);
    const toastId = toast.loading("Waiting for wallet confirmation…");
    try {
      const hash = await submitMint();
      setLastTxHash(hash);
      toast.loading("Transaction submitted, waiting for receipt…", {
        id: toastId,
      });
      const receipt = await waitForTransactionReceipt(wagmi, {
        hash: hash as `0x${string}`,
        chainId: mainnet.id,
      });
      if (receipt.status === "success") {
        toast.success(`Mint confirmed in block #${receipt.blockNumber}`, {
          id: toastId,
        });
      } else {
        toast.error("Transaction reverted", { id: toastId });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error(shortError(message), { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  }

  // --- auto mint (poll until sale is live, then fire) ---------------------

  const checkSaleLive = useCallback(async (): Promise<boolean> => {
    const ctr = contractRef.current;
    // if the contract didn't expose a sale-status view, we just assume it's always "live".
    // the auto-mint loop then relies on tx submission success/failure.
    if (!ctr.saleCheckSupported || !ctr.saleCheckFnName) return true;

    try {
      const fnName = ctr.saleCheckFnName;
      const value = (await readContract(wagmi, {
        address: ctr.address,
        abi: erc721ReadAbi,
        functionName: fnName as
          | "publicSaleActive"
          | "saleIsActive"
          | "mintActive"
          | "paused",
      })) as boolean;
      return fnName === "paused" ? !value : value;
    } catch {
      return false;
    }
  }, [wagmi]);

  async function handleStartAutoMint() {
    if (!isConnected) {
      toast.error("Connect your wallet first");
      return;
    }
    if (!config.selectedFunctionName) {
      toast.error("Select a mint function");
      return;
    }

    runningRef.current = true;
    setAutoState({
      running: true,
      attempts: 0,
      lastError: null,
      lastTxHash: null,
      lastCheckedAt: null,
    });

    toast.success("Auto-mint started", { duration: 2000 });

    while (runningRef.current) {
      setAutoState((s) => ({
        ...s,
        attempts: s.attempts + 1,
        lastCheckedAt: Date.now(),
      }));

      let live = false;
      try {
        live = await checkSaleLive();
      } catch (err) {
        const message = err instanceof Error ? err.message : "check failed";
        setAutoState((s) => ({ ...s, lastError: message }));
      }

      if (live) {
        try {
          const hash = await submitMint();
          setAutoState((s) => ({
            ...s,
            running: false,
            lastTxHash: hash,
            lastError: null,
          }));
          runningRef.current = false;
          setLastTxHash(hash);
          toast.success("Mint submitted! Waiting for receipt…");

          try {
            const receipt = await waitForTransactionReceipt(wagmi, {
              hash: hash as `0x${string}`,
              chainId: mainnet.id,
            });
            if (receipt.status === "success") {
              toast.success(`Mint confirmed in block #${receipt.blockNumber}`);
            } else {
              toast.error("Transaction reverted on-chain");
            }
          } catch (err) {
            const m = err instanceof Error ? err.message : "receipt error";
            toast.error(shortError(m));
          }
          return;
        } catch (err) {
          const message = err instanceof Error ? err.message : "mint failed";
          setAutoState((s) => ({ ...s, lastError: shortError(message) }));
          // user rejected → stop immediately
          if (/rejected|denied|user denied/i.test(message)) {
            runningRef.current = false;
            setAutoState((s) => ({ ...s, running: false }));
            toast.error("Rejected by user. Auto-mint stopped.");
            return;
          }
          // otherwise keep retrying
        }
      }

      await sleep(POLL_INTERVAL_MS);
    }
  }

  function handleStopAutoMint() {
    runningRef.current = false;
    setAutoState((s) => ({ ...s, running: false }));
    toast("Auto-mint stopped");
  }

  // ensure polling stops on unmount
  useEffect(() => {
    return () => {
      runningRef.current = false;
    };
  }, []);

  // --- UI -----------------------------------------------------------------

  const selectedFn = getSelectedFn();
  const selectedSig = selectedFn
    ? formatFunctionSignature(selectedFn)
    : "(none)";

  const disabled =
    !isConnected ||
    !config.selectedFunctionName ||
    isSubmitting ||
    autoState.running;

  return (
    <section className="card">
      <h2 className="mb-1 text-base font-semibold">3. Execute mint</h2>
      <p className="mb-4 text-xs text-zinc-500">
        Manual = one-shot tx you confirm in your wallet. Auto = poll sale status
        and fire as soon as it&apos;s live.
      </p>

      <div className="mb-4 rounded-md border border-border bg-black/30 px-3 py-2 text-xs font-mono text-zinc-300">
        <span className="text-zinc-500">call: </span>
        {selectedSig}
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <button
          onClick={handleManualMint}
          disabled={disabled}
          className="btn-primary"
        >
          {isSubmitting ? "Minting…" : "Mint now (manual)"}
        </button>

        {autoState.running ? (
          <button onClick={handleStopAutoMint} className="btn-danger">
            Stop auto-mint
          </button>
        ) : (
          <button
            onClick={handleStartAutoMint}
            disabled={disabled}
            className="btn-secondary border-accent/60 text-accent hover:bg-accent/10"
          >
            Start auto-mint
          </button>
        )}
      </div>

      {(autoState.running ||
        autoState.attempts > 0 ||
        autoState.lastTxHash) && (
        <div className="mt-4 rounded-md border border-border bg-black/30 px-3 py-2 text-xs">
          <div className="flex items-center gap-2">
            <span
              className={`h-1.5 w-1.5 rounded-full ${
                autoState.running
                  ? "bg-success animate-pulse"
                  : "bg-zinc-500"
              }`}
            />
            <span className="font-medium">
              Auto-mint {autoState.running ? "watching…" : "idle"}
            </span>
            <span className="text-zinc-500">· {autoState.attempts} checks</span>
            {autoState.lastCheckedAt ? (
              <span className="text-zinc-500">
                · last{" "}
                {Math.max(
                  0,
                  Math.round((Date.now() - autoState.lastCheckedAt) / 1000),
                )}
                s ago
              </span>
            ) : null}
          </div>
          {autoState.lastError ? (
            <div className="mt-1 text-danger">
              last error: {autoState.lastError}
            </div>
          ) : null}
        </div>
      )}

      {lastTxHash ? (
        <div className="mt-3 text-xs">
          <span className="text-zinc-500">last tx:</span>{" "}
          <a
            href={`https://etherscan.io/tx/${lastTxHash}`}
            target="_blank"
            rel="noreferrer"
            className="text-accent hover:underline font-mono"
          >
            {lastTxHash.slice(0, 10)}…{lastTxHash.slice(-8)}
          </a>
        </div>
      ) : null}
    </section>
  );
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function shortError(message: string): string {
  // strip long stack traces / repeated context wagmi adds
  const firstLine = message.split("\n")[0];
  return firstLine.length > 140 ? firstLine.slice(0, 137) + "…" : firstLine;
}

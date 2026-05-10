import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

// Use the Node.js runtime — Etherscan fetches are short, and this avoids
// some edge-runtime quirks (URL parsing, fetch timeouts) on Vercel.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Etherscan API V2 — unified multichain endpoint. V1 was deprecated Aug 15, 2025.
// Ethereum mainnet = chain id 1.
const ETHERSCAN_BASE = "https://api.etherscan.io/v2/api";
const CHAIN_ID = 1;

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  // simple healthcheck: /api/abi?health=1
  if (req.nextUrl.searchParams.get("health") === "1") {
    return NextResponse.json({
      ok: true,
      hasEtherscanKey: Boolean(process.env.ETHERSCAN_API_KEY),
      now: new Date().toISOString(),
    });
  }

  if (!address || !isAddress(address)) {
    return NextResponse.json(
      { error: "Invalid or missing address" },
      { status: 400 },
    );
  }

  const key = process.env.ETHERSCAN_API_KEY;
  if (!key) {
    return NextResponse.json(
      {
        error:
          "Server is missing ETHERSCAN_API_KEY. Set it in Vercel → Project → Settings → Environment Variables, then redeploy.",
      },
      { status: 500 },
    );
  }

  try {
    // 1) fetch source (so we also get contract name & implementation address for proxies)
    const sourceRes = await fetch(
      `${ETHERSCAN_BASE}?chainid=${CHAIN_ID}&module=contract&action=getsourcecode&address=${address}&apikey=${key}`,
      { cache: "no-store" },
    );
    const sourceJson = (await sourceRes.json()) as {
      status: string;
      message: string;
      result:
        | Array<{
            ContractName?: string;
            ABI?: string;
            Proxy?: string;
            Implementation?: string;
          }>
        | string;
    };

    // Etherscan returns status "0" + message "NOTOK" for API-level errors (bad
    // key, rate limit, etc). The actual reason is in `result` (a string in
    // that case), not `message`.
    if (sourceJson.status !== "1") {
      const detail =
        typeof sourceJson.result === "string"
          ? sourceJson.result
          : sourceJson.message || "Unknown Etherscan error";
      return NextResponse.json(
        { error: `Etherscan: ${detail}`, message: sourceJson.message },
        { status: 502 },
      );
    }

    if (!Array.isArray(sourceJson.result) || !sourceJson.result[0]) {
      return NextResponse.json(
        { error: "Contract not found on Etherscan" },
        { status: 404 },
      );
    }

    const entry = sourceJson.result[0];
    let abiString = entry.ABI;
    let implementationAddress: string | null = null;

    // handle proxy → fetch implementation ABI
    if (
      entry.Proxy === "1" &&
      entry.Implementation &&
      isAddress(entry.Implementation)
    ) {
      implementationAddress = entry.Implementation;
      const implRes = await fetch(
        `${ETHERSCAN_BASE}?chainid=${CHAIN_ID}&module=contract&action=getabi&address=${implementationAddress}&apikey=${key}`,
        { cache: "no-store" },
      );
      const implJson = (await implRes.json()) as {
        status: string;
        result: string;
      };
      if (implJson.status === "1") {
        abiString = implJson.result;
      }
    }

    if (!abiString || abiString === "Contract source code not verified") {
      return NextResponse.json(
        {
          error:
            "Contract ABI is not verified on Etherscan. Paste the ABI manually.",
        },
        { status: 404 },
      );
    }

    let abi: unknown;
    try {
      abi = JSON.parse(abiString);
    } catch {
      return NextResponse.json(
        { error: "Invalid ABI format returned from Etherscan" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      address,
      contractName: entry.ContractName || null,
      isProxy: entry.Proxy === "1",
      implementationAddress,
      abi,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch ABI: ${message}` },
      { status: 502 },
    );
  }
}

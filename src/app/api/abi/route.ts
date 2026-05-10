import { NextRequest, NextResponse } from "next/server";
import { isAddress } from "viem";

export const runtime = "edge";

const ETHERSCAN_BASE = "https://api.etherscan.io/api";

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

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
          "Server is missing ETHERSCAN_API_KEY. Set it in your environment variables.",
      },
      { status: 500 },
    );
  }

  try {
    // 1) fetch source (so we also get contract name & implementation address for proxies)
    const sourceRes = await fetch(
      `${ETHERSCAN_BASE}?module=contract&action=getsourcecode&address=${address}&apikey=${key}`,
      { cache: "no-store" },
    );
    const sourceJson = (await sourceRes.json()) as {
      status: string;
      message: string;
      result: Array<{
        ContractName?: string;
        ABI?: string;
        Proxy?: string;
        Implementation?: string;
      }>;
    };

    if (sourceJson.status !== "1" || !sourceJson.result?.[0]) {
      return NextResponse.json(
        { error: sourceJson.message || "Contract not found on Etherscan" },
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
        `${ETHERSCAN_BASE}?module=contract&action=getabi&address=${implementationAddress}&apikey=${key}`,
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

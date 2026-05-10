import type { Metadata } from "next";
import { Providers } from "./providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "GetFCFS — NFT Mint Dashboard",
  description:
    "Fast FCFS NFT mint dashboard for Ethereum mainnet. Paste a contract, detect mint function, and fire manual or auto mints with gas presets.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen bg-background text-zinc-100 antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}

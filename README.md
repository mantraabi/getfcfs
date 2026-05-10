# GetFCFS — NFT FCFS Mint Dashboard

A fast, FCFS-friendly NFT mint dashboard for Ethereum mainnet built with
Next.js 14, TypeScript, Tailwind, Wagmi v2 + RainbowKit, and Viem.

## Features

- Connect wallet (MetaMask, WalletConnect, Coinbase, Rabby, etc.)
- Paste an NFT contract address and auto-fetch its ABI from Etherscan
- Auto-detect collection info (name, symbol, totalSupply, maxSupply, mintPrice)
- Pick a mint function from the contract (handles `mint`, `publicMint`, `claim`, etc.)
- Configure quantity, mint price, and recipient
- Gas presets: **Slow / Normal / Fast / Aggressive** (EIP-1559 `maxFeePerGas` + `maxPriorityFeePerGas`)
- **Manual mint** — submit a single transaction and confirm in your wallet
- **Auto mint** — polls the contract and fires the mint tx as soon as the sale is live

> ⚠️ This uses your browser wallet to sign each transaction. There is no burner-wallet / private-key storage on purpose.

## Setup

```bash
npm install
cp .env.example .env.local
# fill in the API keys
npm run dev
```

### Environment variables

| Key | What it's for |
|---|---|
| `NEXT_PUBLIC_ALCHEMY_API_KEY` | Fast RPC for mainnet reads & broadcasting tx |
| `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID` | WalletConnect v2 pairing |
| `ETHERSCAN_API_KEY` | Used server-side to fetch verified contract ABIs |

## Deploying to Vercel

1. Push this repo to GitHub.
2. Import it in Vercel.
3. Add the three env vars above in the Vercel dashboard.
4. Deploy.

## Disclaimer

NFT minting is financial activity. Only interact with contracts you trust, double-check addresses, and never share your seed phrase or private key.

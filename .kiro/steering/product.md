# Frequencii — Product Overview

Frequencii is a **privacy-first AI prediction market platform on Solana**. It lets users trade prediction markets without exposing their wallet, positions, or strategy to chain analysts or competitors.

## Core Value Proposition

On public platforms like Polymarket, every bet is permanently linked to a wallet address. Frequencii breaks this link by routing trades through ZK-shielded ephemeral burner wallets, making positions untraceable.

## Key Features

- **AI Prediction Agent** — LLM-powered market analyst (OpenRouter / Minimax M2.5) with real-time SSE streaming
- **ZK-Shielded Trading** — Ephemeral burner wallets funded via PrivacyCash / Light Protocol; UTXO model breaks deposit-withdrawal link
- **P2P Chat** — Gasless messaging via MagicBlock Ephemeral Rollups with delegated PDAs; settles to Solana L1
- **REST API v1** — 15 JWT-authenticated endpoints for the Flutter mobile client and third-party integrations
- **Mobile App** — React Native / Expo app targeting Android (Solana Seeker first), using Mobile Wallet Adapter (MWA)

## Privacy Flow

```
Main Wallet → ZK Shielded Pool (Light Protocol) → Ephemeral Burner Wallet → Jupiter Prediction Market
```

Each trade uses a fresh burner wallet with zero on-chain history. Winnings route back through the shielded pool.

## Target Users

Power traders on Solana who need to protect their strategy from wallet tracking, copy-trading, and front-running.

## Current Status

Web platform is fully live. Mobile app (React Native / Expo) is in active development — core auth, markets, AI agent, and portfolio screens are working; privacy layer (PrivacyCash SDK) and trade signing via MWA are pending native wiring.

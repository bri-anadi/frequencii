# Frequencii

### Private AI Prediction Agent on Solana

**Your bets. Your business. Nobody else's.**

Frequencii is a privacy-first prediction market platform on Solana that combines **AI-powered market analysis** with **Zero-Knowledge privacy** -- so no one can track your wallet, your positions, or your strategy.

---

## The Problem

On platforms like Polymarket, **every bet you make is public**. Your wallet address is permanently linked to every position, every trade, every win, and every loss. This creates real problems:

- **Wallet Tracking** -- Anyone can monitor whale wallets, copy their trades, or front-run their positions.
- **Identity Doxxing** -- Chain analysis firms link wallets to real identities. Your political bets, your financial predictions -- all exposed.
- **Strategy Leaking** -- Competitors and adversaries can reverse-engineer your conviction and position sizing in real-time.
- **Market Manipulation** -- When large positions are visible, markets move against you before you can execute.

**The result?** Smart traders either avoid prediction markets entirely, or fragment their activity across dozens of burner wallets -- a painful, manual process that still leaves traces.

---

## The Solution

Frequencii breaks the link between **your identity** and **your predictions** -- permanently.

```
Main Wallet --> ZK Shielded Pool --> Ephemeral Burner Wallet --> Prediction Market
                    |                         |
             Identity broken           Fresh wallet per trade
             via Light Protocol        No history, no pattern
```

### How It Works

1. **Deposit** SOL from your main wallet into a ZK-shielded pool (PrivacyCash / Light Protocol)
2. **Generate** an ephemeral burner wallet with zero on-chain history
3. **Fund** the burner wallet from the shielded pool -- no link to your identity
4. **Trade** on Jupiter Prediction Markets through the burner
5. **Withdraw** winnings back through the shielded pool to any wallet

No one -- not chain analysts, not other traders, not the platform itself -- can connect your bets to your real wallet.

---

## Key Features

### AI Prediction Agent
An LLM-powered market analyst that streams real-time analysis directly to you.

- **Real-time analysis** of prediction market odds, volume shifts, and sentiment
- **Structured reasoning** -- probability assessment, key factors, confidence scoring
- **Market context awareness** -- automatically ingests current market data
- **SSE streaming** -- responses stream in real-time via Server-Sent Events
- **Powered by**: OpenRouter (Minimax M2.5)

### ZK-Shielded Trading
Trade predictions without exposing your wallet or strategy.

- **Zero-Knowledge proofs** break the on-chain link between sender and receiver
- **Ephemeral burner wallets** -- fresh address per trade session, funded via PrivacyCash
- **UTXO model** -- transaction unlinkability prevents chain analysis
- **Powered by**: PrivacyCash SDK & Light Protocol

### High-Frequency P2P Chat
Instant, gasless messaging secured by Solana.

- **MagicBlock Ephemeral Rollups** -- 1000+ messages/sec, zero gas
- **Delegated PDAs** -- no popup signing for every message
- **On-chain settlement** -- final state settles to Solana L1
- **Private gifting** -- send anonymous shielded SOL tips in chat

### Mobile API (v1)
Full REST API for Flutter mobile client and third-party integrations.

- **JWT authentication** via Solana wallet signatures
- **15 endpoints** -- markets, trading, positions, agent, profile, watchlist
- **SSE streaming** for real-time AI agent on mobile
- **Interactive docs** at [`/api/v1/docs`](http://localhost:3000/api/v1/docs) (Scalar)

---

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Privacy** | PrivacyCash / Light Protocol | ZK-compressed shielded transactions, UTXO state |
| **Scaling** | MagicBlock Ephemeral Rollups | Gasless chat via delegated PDAs on SVM L2 |
| **AI** | OpenRouter (Minimax M2.5) | LLM-powered prediction market analysis |
| **Markets** | Jupiter Prediction API | Live odds, volume, trading execution on Solana |
| **Auth** | JWT + Solana Wallet Signatures | Stateless mobile authentication (ed25519) |
| **Persistence** | SQLite (better-sqlite3) | User profiles, watchlists, push tokens |
| **RPC** | Helius | High-performance Solana RPC (99.9% uptime) |
| **Frontend** | Next.js + Once UI | Responsive web interface |
| **API Docs** | OpenAPI 3.1 + Scalar | Interactive API reference |

---

## Privacy Architecture

```
+----------------------------------------------------------+
|                    YOUR MAIN WALLET                       |
|                  (publicly known)                         |
+----------------------------+-----------------------------+
                             | Deposit
                             v
+----------------------------------------------------------+
|             ZK SHIELDED POOL (Light Protocol)             |
|                                                           |
|  - UTXO-based state                                       |
|  - Zero-knowledge proofs verify ownership                 |
|  - No public link between deposit and withdrawal          |
|  - Relayer submits transactions (sender hidden)           |
+----------------------------+-----------------------------+
                             | Withdraw to burner
                             v
+----------------------------------------------------------+
|             EPHEMERAL BURNER WALLET                        |
|                                                           |
|  - Fresh address with zero history                        |
|  - Funded exclusively from shielded pool                  |
|  - Used for a single trading session                      |
|  - Discarded after use                                    |
+----------------------------+-----------------------------+
                             | Trade
                             v
+----------------------------------------------------------+
|          JUPITER PREDICTION MARKETS                       |
|                                                           |
|  - Positions held by burner wallet                        |
|  - No connection to your real identity                    |
|  - Winnings route back through shielded pool              |
+----------------------------------------------------------+
```

### What's Hidden

| Data Point | On Polymarket | On Frequencii |
| :--- | :--- | :--- |
| Your wallet address | PUBLIC | Hidden behind burner |
| Position sizes | PUBLIC | Only burner wallet visible |
| Trade history | Permanently on-chain | Burner is ephemeral |
| Funding source | Traceable | ZK-shielded |
| Win/loss record | Anyone can calculate | Cannot link to you |
| Trading patterns | Analyzable | Each session is a new wallet |

---

## REST API (v1)

**Interactive Docs**: [`/api/v1/docs`](http://localhost:3000/api/v1/docs)
**OpenAPI Spec**: [`/api/v1/openapi.json`](http://localhost:3000/api/v1/openapi.json)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Authenticate with Solana wallet signature, returns JWT |
| `POST` | `/api/v1/auth/refresh` | Refresh JWT token |
| `GET` | `/api/v1/markets` | List prediction markets (filter, search, paginate) |
| `GET` | `/api/v1/markets/:id` | Get market detail |
| `POST` | `/api/v1/trade` | Build trade transaction |
| `GET` | `/api/v1/positions` | List open/resolved positions |
| `POST` | `/api/v1/positions/:id/claim` | Claim payout |
| `POST` | `/api/v1/agent/chat` | AI agent analysis (SSE streaming) |
| `GET` | `/api/v1/user/profile` | Get user profile |
| `PUT` | `/api/v1/user/profile` | Update user profile |
| `POST` | `/api/v1/user/push-token` | Register FCM push token |
| `DELETE` | `/api/v1/user/push-token` | Unregister push token |
| `GET` | `/api/v1/watchlist` | List watchlist |
| `POST` | `/api/v1/watchlist/:eventId` | Add to watchlist |
| `DELETE` | `/api/v1/watchlist/:eventId` | Remove from watchlist |

### Auth Flow

```
1. Client signs: "Frequencii Auth: {timestamp}"
2. POST /api/v1/auth/login { pubkey, signature, message }
3. Server verifies ed25519 signature (tweetnacl)
4. Returns JWT (valid 7 days)
5. All subsequent requests: Authorization: Bearer <token>
```

---

## Project Structure

```
frequencii/
|-- contracts/frequencii_chat/     # Anchor smart contract (P2P chat)
|-- src/
|   |-- app/
|   |   |-- (main)/components/     # UI components
|   |   |   |-- AgentChat          # AI prediction agent
|   |   |   |-- MarketBrowser      # Market discovery
|   |   |   |-- MarketDetail       # Market analysis
|   |   |   |-- TradePanel         # Trade execution
|   |   |   |-- PortfolioView      # Position tracking
|   |   |   |-- PrivateWalletSetup # Burner wallet setup flow
|   |   |   |-- GiftModal          # Shielded transfers
|   |   |   |-- UnifiedChatWindow  # P2P messaging
|   |   |   +-- UnifiedSidebar     # Navigation
|   |   +-- api/
|   |       |-- v1/                # REST API for mobile
|   |       |   |-- auth/          #   JWT login & refresh
|   |       |   |-- markets/       #   List & detail
|   |       |   |-- trade/         #   Build transactions
|   |       |   |-- positions/     #   Positions & claims
|   |       |   |-- agent/chat/    #   AI streaming
|   |       |   |-- user/          #   Profile & push tokens
|   |       |   |-- watchlist/     #   Market watchlist
|   |       |   +-- docs/          #   Scalar API docs
|   |       |-- agent/             # Web AI agent
|   |       |-- jupiter/           # Web Jupiter proxy
|   |       +-- og/                # OG image proxy
|   +-- lib/
|       |-- api/                   # Shared API modules
|       |   |-- auth.ts            #   JWT + wallet verification
|       |   |-- db.ts              #   SQLite persistence
|       |   |-- cors.ts            #   CORS headers
|       |   |-- jupiter.ts         #   Jupiter API client
|       |   +-- openapi.ts         #   OpenAPI spec
|       |-- hooks/                 # React hooks
|       |   |-- useBurnerWallet.ts #   Burner wallet lifecycle
|       |   +-- useJupiterPredict.ts # Jupiter trade execution
|       +-- types.ts               # Shared TypeScript types
+-- package.json
```

---

## Getting Started

### Prerequisites

- Node.js >= 18
- pnpm
- Solana CLI (for contract deployment)

### Setup

```bash
git clone https://github.com/bri-anadi/frequencii.git
cd frequencii
pnpm install
cp .env.example .env
# Edit .env with your API keys
pnpm dev
```

### Environment Variables

| Variable | Description |
| :--- | :--- |
| `NEXT_PUBLIC_HELIUS_RPC_URL` | Helius RPC API key |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Reown (WalletConnect) project ID |
| `OPENROUTER_API_KEY` | OpenRouter API key for AI agent |
| `JUPITER_API_KEY` | Jupiter Prediction API key |
| `JWT_SECRET` | Secret for signing JWT tokens |

---

## Roadmap

### Phase 1: Core Platform (Completed)
- [x] AI prediction agent with SSE streaming
- [x] Jupiter Prediction Market integration
- [x] ZK-shielded transfers (PrivacyCash)
- [x] Ephemeral burner wallet infrastructure
- [x] P2P chat via MagicBlock Ephemeral Rollups
- [x] REST API v1 with JWT auth & OpenAPI docs

### Phase 2: Mobile & Privacy Expansion (Q2 2026)
- [ ] Flutter mobile app (iOS/Android)
- [ ] Push notifications for market alerts
- [ ] Automated burner wallet rotation
- [ ] Multi-market portfolio privacy

### Phase 3: Advanced Intelligence (Q3 2026)
- [ ] Multi-model AI consensus analysis
- [ ] Historical accuracy tracking
- [ ] Community sentiment aggregation
- [ ] Privacy-preserving reputation scores

### Phase 4: Ecosystem
- [ ] Developer SDK for privacy layer
- [ ] Cross-platform agent API

---

## License

MIT

---

**Frequencii** -- because in prediction markets, the smartest trade is the one nobody sees.

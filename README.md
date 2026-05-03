# Frequencii World

### Privacy-First Social Layer on Solana

**Frequencii** is a next-generation on-chain social platform that harmonizes high-frequency real-time interactions with robust user privacy. Built at the intersection of **Zero-Knowledge Proofs (ZKP)** and **Ephemeral Rollups**, Frequencii solves the "Privacy vs. Performance" dilemma in Web3 social apps.

---

## Vision

In the current Web3 social landscape, users are forced to choose between:
1.  **Transparency**: Every like, DM, and tip is permanently visible on-chain.
2.  **Sluggishness**: On-chain interactions are often slow and costly.

**Frequencii World** introduces a hybrid architecture where:
*   **Assets** (Tips/Gifts) are **shielded** — providing financial privacy.
*   **Interactions** (Chats/Actions) are **ephemeral** — providing speed and temporary privacy before settlement.

---

## Key Features

### 1. Private Gifts (Shielded Transfers)
Send anonymous, shielded asset transfers to any user without revealing your main wallet address or transaction history.
*   **Powered by**: PrivacyCash SDK & Light Protocol.
*   **Mechanism**: Users "deposit" public SOL into a shielded pool, generating a ZK-proof of ownership (UTXO). Sending a gift involves "withdrawing" or transferring this shielded UTXO to the recipient's address, breaking the on-chain link between sender and receiver.
*   **User Benefit**: Tip your favorite creators or friends without doxxing your net worth or transaction habits.

### 2. High-Frequency P2P Chat
Experience instant, gasless messaging that feels like Web2 but is secured by Solana.
*   **Powered by**: MagicBlock Ephemeral Rollups.
*   **Mechanism**: Chat messages are processed on high-speed ephemeral rollups (SVM) and only the final state is settled to Solana Mainnet. This enables thousands of confirmed messages per second at zero cost to the user.
*   **User Benefit**: No popup signing for every message. No gas fees. Just chat.

### 3. AI Prediction Agent (Private Trading)
Analyze prediction markets with AI and place fully private trades through ZK-shielded burner wallets.
*   **AI Engine**: OpenRouter (Minimax M2.5) provides real-time market analysis, risk assessment, and trading recommendations.
*   **Market Data**: Jupiter Prediction API supplies live odds, volume, liquidity, and event metadata.
*   **Trade Execution**: Jupiter Prediction API enables native Solana prediction market trading without cross-chain bridging.
*   **Privacy Architecture**: All prediction trades route through an ephemeral burner wallet funded via PrivacyCash (Main Wallet → ZK Shielded Pool → Burner Wallet), breaking the on-chain link between user identity and prediction positions.
*   **User Benefit**: Get AI-powered market insights and trade predictions with complete anonymity — no one can link your bets to your main wallet.

---

## Technology Stack & Architecture

We leverage a composable stack of cutting-edge Solana technologies:

| Component | Technology | Role |
| :--- | :--- | :--- |
| **Privacy Layer** | **PrivacyCash / Light Protocol** | Handles ZK-compression, UTXO state management, and shielded transactions. |
| **Scaling Layer** | **MagicBlock (Ephemeral Rollups)** | Usage of "Delegated PDAs" to enable gasless, signature-free session keys for chat. |
| **AI Layer** | **OpenRouter (Minimax M2.5)** | LLM-powered market analysis and prediction recommendations. |
| **Market Data** | **Jupiter Prediction API** | Live prediction market odds, volume, and event data. |
| **Prediction Trading** | **Jupiter Prediction API** | Native Solana prediction market order execution. |
| **Auth** | **JWT + Solana Wallet Signatures** | Stateless authentication via wallet-signed messages and JSON Web Tokens. |
| **Persistence** | **SQLite (better-sqlite3)** | Lightweight local storage for user profiles, watchlists, and push tokens. |
| **Infrastructure** | **Helius** | High-performance RPCs ensuring 99.9% uptime for transaction delivery. |
| **Frontend** | **Next.js + Once UI** | A responsive, modern interface designed for mass adoption. |
| **API Docs** | **OpenAPI 3.1 + Scalar** | Interactive API reference for mobile and third-party integrations. |

---

## REST API (v1)

Frequencii exposes a full RESTful API at `/api/v1` for mobile client consumption (Flutter) and third-party integrations. All endpoints (except auth) require a JWT token obtained via Solana wallet signature.

**📖 Interactive Docs**: [`/api/v1/docs`](http://localhost:3000/api/v1/docs) — Scalar UI with the deep space theme.  
**📄 OpenAPI Spec**: [`/api/v1/openapi.json`](http://localhost:3000/api/v1/openapi.json)

### Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/auth/login` | Authenticate with Solana wallet signature → JWT |
| `POST` | `/api/v1/auth/refresh` | Refresh an existing JWT token |
| `GET` | `/api/v1/markets` | List prediction markets (filter by category, search) |
| `GET` | `/api/v1/markets/:id` | Get single market detail |
| `POST` | `/api/v1/trade` | Build a trade transaction (client signs & submits) |
| `GET` | `/api/v1/positions` | List user's open/resolved positions |
| `POST` | `/api/v1/positions/:id/claim` | Build a claim payout transaction |
| `POST` | `/api/v1/agent/chat` | AI agent analysis (SSE streaming) |
| `GET` | `/api/v1/user/profile` | Get user profile |
| `PUT` | `/api/v1/user/profile` | Update display name / avatar |
| `POST` | `/api/v1/user/push-token` | Register FCM push token |
| `DELETE` | `/api/v1/user/push-token` | Unregister push token |
| `GET` | `/api/v1/watchlist` | List watchlisted markets |
| `POST` | `/api/v1/watchlist/:eventId` | Add market to watchlist |
| `DELETE` | `/api/v1/watchlist/:eventId` | Remove from watchlist |

### Authentication Flow

```
1. Client signs message: "Frequencii Auth: {timestamp}"
2. POST /api/v1/auth/login { pubkey, signature, message }
3. Server verifies signature via tweetnacl (ed25519)
4. Returns JWT token (valid 7 days)
5. Client includes: Authorization: Bearer <token>
```

---

## Project Structure

```
frequencii/
├── contracts/                    # Solana programs (Anchor)
│   └── frequencii_chat/          # On-chain chat program
├── src/
│   ├── app/
│   │   ├── (main)/
│   │   │   ├── components/       # UI components
│   │   │   │   ├── AgentChat     # AI prediction agent
│   │   │   │   ├── MarketBrowser # Market discovery
│   │   │   │   ├── MarketDetail  # Market analysis view
│   │   │   │   ├── TradePanel    # Trade execution
│   │   │   │   ├── PortfolioView # Position tracking
│   │   │   │   ├── GiftModal     # Shielded transfers
│   │   │   │   ├── UnifiedChat   # P2P messaging
│   │   │   │   └── UnifiedSidebar
│   │   │   └── layout.tsx
│   │   └── api/
│   │       ├── agent/            # Web AI agent (SSE)
│   │       ├── jupiter/          # Web Jupiter proxy
│   │       ├── og/               # OG image proxy
│   │       └── v1/               # REST API for mobile
│   │           ├── auth/         # login, refresh
│   │           ├── markets/      # list, detail
│   │           ├── trade/        # build transaction
│   │           ├── positions/    # list, claim
│   │           ├── agent/chat/   # AI streaming
│   │           ├── user/         # profile, push-token
│   │           ├── watchlist/    # manage watchlist
│   │           ├── docs/         # Scalar API docs
│   │           └── openapi.json/ # OpenAPI spec
│   ├── lib/
│   │   ├── api/                  # Shared API modules
│   │   │   ├── auth.ts           # JWT + wallet signature
│   │   │   ├── cors.ts           # CORS headers
│   │   │   ├── db.ts             # SQLite persistence
│   │   │   ├── jupiter.ts        # Jupiter API client
│   │   │   └── openapi.ts        # OpenAPI 3.1 spec
│   │   ├── types.ts              # Shared TypeScript types
│   │   └── data.ts               # Constants & config
│   └── components/               # Shared UI components
├── .env.example
├── next.config.mjs
└── package.json
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18
- **pnpm** (recommended) or npm
- **Solana CLI** (for contract deployment)
- **Anchor** ≥ 0.32 (for contract development)

### Installation

```bash
# Clone the repository
git clone https://github.com/bri-anadi/frequencii.git
cd frequencii

# Install dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env with your API keys
```

### Environment Variables

| Variable | Required | Description |
| :--- | :---: | :--- |
| `NEXT_PUBLIC_HELIUS_RPC_URL` | ✅ | Helius RPC API key for Solana |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | ✅ | Reown (WalletConnect) project ID |
| `OPENROUTER_API_KEY` | ✅ | OpenRouter API key for AI agent |
| `JUPITER_API_KEY` | ✅ | Jupiter Prediction API key |
| `JWT_SECRET` | ✅ | Secret key for signing JWT tokens |

### Development

```bash
# Start dev server
pnpm dev

# Build for production
pnpm build

# Start production server
pnpm start
```

### API Documentation

Once the dev server is running, visit:
- **Interactive docs**: [http://localhost:3000/api/v1/docs](http://localhost:3000/api/v1/docs)
- **OpenAPI spec**: [http://localhost:3000/api/v1/openapi.json](http://localhost:3000/api/v1/openapi.json)

---

## Roadmap

We are building towards a comprehensive privacy-centric social ecosystem.

### Phase 1: Foundations ✅
*   [x] **P2P Chat**: Fundamental implementation using MagicBlock.
*   [x] **Private Gift**: Integration of PrivacyCash for anonymous SOL tipping.
*   [x] **AI Prediction Agent**: Market analysis with SSE streaming.
*   [x] **Market Trading**: Jupiter Prediction API integration.
*   [x] **REST API v1**: Full mobile API with JWT auth, OpenAPI docs.

### Phase 2: Mobile & Expanded Privacy (Q2 2026)
*   [ ] **Flutter Mobile App**: Native iOS/Android client consuming API v1.
*   [ ] **Push Notifications**: FCM integration for market alerts.
*   [ ] **Global / Public Chat**: Public spaces with ZK-verified pseudonyms.
*   [ ] **Secret Addresses**: Receiving funds into shielded accounts.

### Phase 3: Community Tools (Q3 2026)
*   [ ] **Chat Grouping**: Encrypted private groups and token-gated channels.
*   [ ] **Reputation System**: Privacy-preserving reputation scores.
*   [ ] **Market Watchlist Alerts**: Real-time notifications on watched markets.

### Phase 4: Ecosystem Growth
*   [ ] **Developer SDK**: Allow other apps to plug into Frequencii's privacy layer.
*   [ ] **Advanced AI**: Multi-model consensus for prediction analysis.

---

## License

MIT

---

Frequencii demonstrates that **privacy is not a feature, but a layer**. By seamlessly integrating PrivacyCash for financial privacy and MagicBlock for interaction scalability, we provide a blueprint for the future of SocialFi — where being social doesn't mean being exposed.

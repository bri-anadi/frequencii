# Frequencii — Project Structure

## Top-Level Layout

```
frequencii/
├── src/                        # Next.js web app source
├── apps/
│   └── mobile/                 # React Native / Expo mobile app
├── contracts/
│   └── frequencii_chat/        # Anchor smart contract (P2P chat on Solana)
├── .kiro/                      # Kiro specs and steering
├── package.json                # Root — web app + pnpm workspace scripts
├── tsconfig.json               # Web app TypeScript config (excludes apps/, contracts/)
├── .eslintrc.json              # ESLint (next/core-web-vitals)
└── .env / .env.example         # Environment variables
```

## Web App (`src/`)

### App Router (`src/app/`)

```
src/app/
├── (main)/                     # Main web UI (route group, no URL segment)
│   ├── layout.tsx              # Root layout with wallet providers
│   ├── page.tsx                # Entry page
│   └── components/             # Feature UI components (co-located with routes)
│       ├── AgentChat.tsx       # AI prediction agent chat UI
│       ├── MarketBrowser.tsx   # Market list and search
│       ├── MarketCard.tsx      # Individual market card
│       ├── MarketDetail.tsx    # Market detail view
│       ├── MarketPanel.tsx     # Market panel wrapper
│       ├── TradePanel.tsx      # Trade execution UI
│       ├── PortfolioView.tsx   # Positions and portfolio
│       ├── PrivateWalletSetup.tsx  # Burner wallet setup flow
│       ├── GiftModal.tsx       # Shielded SOL gift UI
│       ├── UnifiedChatWindow.tsx   # P2P messaging UI
│       ├── AddContactModal.tsx # Add chat contact
│       └── UnifiedSidebar.tsx  # Navigation sidebar
└── api/
    ├── agent/                  # Web AI agent proxy (non-v1)
    ├── jupiter/                # Web Jupiter API proxy
    ├── og/                     # OG image proxy
    └── v1/                     # REST API for mobile clients
        ├── auth/               # POST /login, POST /refresh
        ├── markets/            # GET /markets, GET /markets/:id
        ├── trade/              # POST /trade
        ├── positions/          # GET /positions, POST /positions/:id/claim
        ├── agent/chat/         # POST /agent/chat (SSE)
        ├── user/               # GET/PUT /user/profile, push tokens
        ├── watchlist/          # GET/POST/DELETE /watchlist/:eventId
        ├── seeker/             # GET /seeker/verify
        ├── docs/               # Scalar interactive API docs
        └── openapi.json/       # OpenAPI 3.1 spec endpoint
```

### Shared Library (`src/lib/`)

```
src/lib/
├── api/                        # Server-side API utilities (used by route handlers)
│   ├── auth.ts                 # JWT sign/verify, wallet signature verification, withAuth middleware
│   ├── db.ts                   # SQLite singleton (better-sqlite3), table init, query helpers
│   ├── cors.ts                 # CORS headers + jsonResponse helper
│   ├── jupiter.ts              # Jupiter Prediction API client
│   ├── openapi.ts              # OpenAPI spec definition
│   └── seeker.ts               # Seeker Genesis Token verification
├── hooks/                      # React hooks (client-side web)
│   ├── useAgent.ts             # AI agent SSE streaming
│   ├── useBurnerWallet.ts      # Ephemeral burner wallet lifecycle
│   ├── useChatRollup.ts        # MagicBlock chat send/rollup
│   ├── useChatListener.ts      # MagicBlock chat message listener
│   ├── useJupiterPredict.ts    # Jupiter trade execution
│   ├── useMarkets.ts           # Market data fetching
│   ├── usePrivacyCash.ts       # PrivacyCash SDK wrapper
│   └── useTokenBalance.ts      # SPL token balance
├── types.ts                    # Shared TypeScript types
├── chatUtils.ts                # Chat message utilities
└── data.ts                     # Static data / constants
```

## Mobile App (`apps/mobile/src/`)

```
apps/mobile/src/
├── App.tsx                     # Root component, tab navigation, session restore
├── api/
│   └── client.ts               # apiRequest helper, ApiError class
├── config/
│   └── env.ts                  # EXPO_PUBLIC_* env vars
├── solana/
│   ├── MobileWalletProvider.tsx    # Wraps @wallet-ui MobileWalletProvider
│   ├── authorizationCache.ts       # MWA auth token persistence (SecureStore)
│   └── useFrequenciiWallet.ts      # useMobileWallet + address helper
└── features/                   # Feature-based organization
    ├── auth/
    │   └── useMobileAuth.ts    # Sign-in, sign-out, session restore, JWT refresh
    ├── agent/
    │   ├── AgentScreen.tsx     # AI chat UI
    │   └── useMobileAgent.ts   # SSE streaming hook
    ├── markets/
    │   └── MarketsScreen.tsx   # Market list, detail modal, trade
    ├── positions/
    │   └── PositionsScreen.tsx # Portfolio + claim
    ├── privacy/
    │   └── PrivacyScreen.tsx   # Privacy layer status + draft UIs
    ├── seeker/
    │   └── SeekerPanel.tsx     # Genesis Token verification
    ├── profile/
    │   └── ProfileScreen.tsx   # Profile, watchlist, push tokens, session
    └── trade/
        └── useMobileJupiterPredict.ts  # Trade + claim API calls
```

## Conventions

### API Route Handlers (Next.js App Router)
- Each route exports named HTTP method functions: `GET`, `POST`, `PUT`, `DELETE`
- All protected routes call `withAuth(request)` and check `isAuthError(result)` before proceeding
- Responses use the `jsonResponse()` helper from `src/lib/api/cors.ts` (handles CORS headers)
- Validation uses `zod` schemas inline in the route handler

### Shared API Modules (`src/lib/api/`)
- Server-only — never imported by client components
- `db.ts` exports a singleton `getDb()` — do not instantiate `Database` directly
- `auth.ts` exports `withAuth` middleware and `isAuthError` type guard — use these for all protected routes

### React Hooks (`src/lib/hooks/`)
- Client-side only — all hooks use React state and browser APIs
- Hooks encapsulate all Solana/privacy SDK interactions; components should not call SDKs directly

### TypeScript
- Use the `@/*` path alias for all imports within `src/` (e.g. `import { getDb } from "@/lib/api/db"`)
- Shared types live in `src/lib/types.ts`
- `strict: true` is enforced — avoid `any`, use proper type guards

### Mobile Feature Structure
- Each feature lives in `src/features/{feature}/` with a screen component and optional hook
- All API calls go through `src/api/client.ts` — never use `fetch` directly in screens
- JWT stored in `expo-secure-store` under `frequencii_mobile_jwt`
- MWA auth cache stored under `frequencii_mwa_authorization_mainnet_v1`

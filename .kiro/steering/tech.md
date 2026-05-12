# Frequencii — Tech Stack & Build System

## Monorepo Structure

Managed with **pnpm workspaces**. The root is a Next.js web app; the mobile app lives in `apps/mobile`.

## Web App (Root)

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | `--webpack` flag used (not Turbopack) |
| Language | TypeScript 5.8 | `strict: true`, path alias `@/*` → `src/*` |
| UI | Once UI (`@once-ui-system/core`) + SASS | Component library + custom styles |
| Wallet | Reown AppKit + Solana wallet adapters | Phantom, Solflare, WalletConnect |
| Solana | `@solana/web3.js` 1.x, `@coral-xyz/anchor` | Web3.js v1 (not v2/kit) |
| Privacy | `privacycash` SDK + `@lightprotocol/hasher.rs` | ZK shielded pool |
| Chat | `@magicblock-labs/ephemeral-rollups-sdk/kit` | Gasless P2P messaging |
| AI | OpenRouter API (Minimax M2.5) via `fetch` | SSE streaming |
| Markets | Jupiter Prediction API | Proxied through `/api/jupiter` |
| Auth | `jose` (JWT) + `tweetnacl` (ed25519) | Stateless JWT, 7-day expiry |
| Database | `better-sqlite3` | SQLite singleton, WAL mode |
| API Docs | `@scalar/nextjs-api-reference` + OpenAPI 3.1 | Interactive docs at `/api/v1/docs` |
| Validation | `zod` 4.x | Request/response validation |
| Linting | ESLint (`next/core-web-vitals`) + Biome 1.9.4 | Biome for formatting |
| Charts | `recharts` | Portfolio/market data visualization |
| Markdown | `react-markdown` + `remark-gfm` | AI agent response rendering |

## Mobile App (`apps/mobile`)

| Layer | Technology | Notes |
|---|---|---|
| Framework | React Native 0.83.6 + Expo 55 | Custom dev build required (not Expo Go) |
| Language | TypeScript 5.9 | |
| Wallet | `@wallet-ui/react-native-web3js` 4.x | Wraps MWA protocol |
| Solana | `@solana/web3.js` 1.x + `@solana/kit` 6.x | |
| Storage | `expo-secure-store` | JWT + MWA auth cache |
| Crypto | `react-native-quick-crypto` | Native crypto polyfill |
| Build | `expo run:android` | First build compiles native; subsequent use dev client |

## Common Commands

### Web App (run from repo root)

```bash
pnpm install          # Install all dependencies
pnpm dev              # Start Next.js dev server (webpack mode)
pnpm build            # Production build
pnpm start            # Start production server
pnpm lint             # ESLint check
pnpm biome-write      # Auto-format with Biome
```

### Mobile App

```bash
# Run against local backend (Android emulator)
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 pnpm mobile:android

# Run against production API
pnpm mobile:android

# Type-check mobile app
pnpm mobile:typecheck

# Start Expo dev server only (requires existing native build)
pnpm mobile
```

## Environment Variables

| Variable | Used By | Description |
|---|---|---|
| `NEXT_PUBLIC_HELIUS_RPC_URL` | Web | Helius RPC endpoint (client-side) |
| `NEXT_PUBLIC_REOWN_PROJECT_ID` | Web | Reown/WalletConnect project ID |
| `OPENROUTER_API_KEY` | API | OpenRouter key for AI agent |
| `JUPITER_API_KEY` | API | Jupiter Prediction API key |
| `JWT_SECRET` | API | JWT signing secret |
| `HELIUS_MAINNET_RPC_URL` | API | Server-side Helius RPC (Seeker verification) |
| `FREQUENCII_DB_PATH` | API | SQLite path override (defaults to `/tmp` on serverless) |
| `EXPO_PUBLIC_API_BASE_URL` | Mobile | Backend base URL |
| `EXPO_PUBLIC_SOLANA_CHAIN` | Mobile | MWA chain ID (default: `solana:mainnet`) |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | Mobile | Solana RPC for mobile |

## TypeScript Configuration

- Root `tsconfig.json` excludes `contracts/`, `apps/`, and `packages/` — mobile has its own tsconfig
- Path alias: `@/*` maps to `src/*`
- `strict: true` — no implicit any, strict null checks
- Target: ES2017, module resolution: `bundler`

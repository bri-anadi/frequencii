# Frequencii Mobile — Full Documentation

> **Goal**: Port the Frequencii web platform to a native Android app using React Native (Expo), the Solana Mobile Wallet Adapter (MWA), and the existing REST API v1 backend.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Overview](#2-architecture-overview)
3. [Solana Mobile Stack Integration](#3-solana-mobile-stack-integration)
4. [Feature Flow — Screen by Screen](#4-feature-flow--screen-by-screen)
5. [Authentication Flow](#5-authentication-flow)
6. [API Integration](#6-api-integration)
7. [Privacy Layer — Migration Status](#7-privacy-layer--migration-status)
8. [Seeker Device Support](#8-seeker-device-support)
9. [Tech Stack](#9-tech-stack)
10. [Project Structure](#10-project-structure)
11. [Environment Configuration](#11-environment-configuration)
12. [Development Setup](#12-development-setup)
13. [Roadmap & Gaps](#13-roadmap--gaps)

---

## 1. Project Overview

Frequencii is a **privacy-first AI prediction market platform on Solana**. The web app (Next.js) is fully live. The mobile app (`apps/mobile`) is a React Native / Expo project that:

- Connects to an MWA-compatible wallet (e.g. Phantom) installed on the same Android device
- Authenticates via a Solana wallet signature → JWT flow against the existing REST API
- Exposes all core features: AI agent chat, market browsing, portfolio, privacy layer, Seeker verification, and profile management
- Is purpose-built for the **Solana Seeker** device but runs on any MWA-capable Android

The mobile app is **not** a standalone Solana client — it delegates all blockchain reads/writes to the backend API and uses MWA only for wallet authorization and message signing.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    MOBILE APP (React Native / Expo)          │
│                                                              │
│  MobileWalletProvider (@wallet-ui/react-native-web3js)       │
│  └── useMobileAuth  ──► MWA authorize + signMessages         │
│                                                              │
│  Screens                                                     │
│  ├── AgentScreen      (AI chat + SSE streaming)              │
│  ├── MarketsScreen    (browse, search, trade)                │
│  ├── PositionsScreen  (portfolio + claim)                    │
│  ├── PrivacyScreen    (privacy layer status)                 │
│  ├── SeekerPanel      (Genesis Token verification)           │
│  └── ProfileScreen    (profile, watchlist, push tokens)      │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS REST + SSE
                       ▼
┌─────────────────────────────────────────────────────────────┐
│              BACKEND  (Next.js — frequencii.world)           │
│                                                              │
│  /api/v1/auth/login        JWT issuance                      │
│  /api/v1/markets           Jupiter Prediction API proxy      │
│  /api/v1/trade             Build + simulate transactions     │
│  /api/v1/positions         Open/resolved positions           │
│  /api/v1/agent/chat        SSE AI streaming (OpenRouter)     │
│  /api/v1/user/*            Profile + push tokens             │
│  /api/v1/watchlist/*       Saved markets                     │
│  /api/v1/seeker/verify     Genesis Token check               │
└──────────────────────┬──────────────────────────────────────┘
                       │
          ┌────────────┼────────────┐
          ▼            ▼            ▼
      Helius RPC   Jupiter API   SQLite DB
      (Solana)     (Markets)     (Users/Watchlist)
```

### Key Design Decisions

| Decision | Rationale |
|---|---|
| All Solana RPC calls go through the backend | Keeps RPC keys server-side; mobile only needs JWT |
| MWA used only for authorize + signMessages | One wallet open per login; no per-trade wallet popups |
| JWT stored in `expo-secure-store` | Encrypted native keychain; survives app restarts |
| SSE streaming via `fetch` + `ReadableStream` | No WebSocket dependency; works with the existing backend |
| `@wallet-ui/react-native-web3js` wraps MWA | Provides a React context + `useMobileWallet` hook over the raw MWA protocol |

---

## 3. Solana Mobile Stack Integration

### What is the Solana Mobile Stack?

The [Solana Mobile Stack (SMS)](https://docs.solanamobile.com/solana-mobile-stack/overview) is a set of open-source Android libraries and protocols that enable native Solana dApps on mobile. The key component used here is **Mobile Wallet Adapter (MWA)**.

### Mobile Wallet Adapter (MWA)

MWA is a protocol that lets a dApp communicate with a wallet app installed on the same Android device (or emulator). The dApp never holds private keys — it sends requests to the wallet, which displays them to the user and returns signed results.

**MWA request types used by Frequencii:**

| MWA Method | When Used | Purpose |
|---|---|---|
| `authorize` | Login | Establish a session with the wallet; get the account's public key |
| `signMessages` | Login | Sign the `"Frequencii Auth: {timestamp}"` message for JWT issuance |

Frequencii does **not** use `signTransactions` or `signAndSendTransactions` directly from mobile — trade transactions are built server-side and submitted via the `/api/v1/trade` endpoint.

### MWA Session Flow

```
App                          Wallet (Phantom)
 │                                │
 │── connectAnd() ───────────────►│  Opens wallet app
 │                                │
 │── authorize({ chain, identity })►│  User approves dApp connection
 │◄── { accounts: [{ address }] } ─│
 │                                │
 │── signMessages({ payloads })──►│  User approves signature
 │◄── [signedPayload (64B sig + msg)]│
 │                                │
 │  (wallet closes / returns)     │
 │                                │
 │── POST /api/v1/auth/login ─────────────► Backend
 │◄── { token, user } ────────────────────── Backend
```

Both `authorize` and `signMessages` happen inside a **single `connectAnd` session** — the wallet opens once, not twice.

### Authorization Cache

MWA authorization tokens are cached in `expo-secure-store` under the key `frequencii_mwa_authorization_mainnet_v1`. This means the wallet does not need to re-authorize on every app launch — only on first connect or after a session reset.

The cache is cleared before each new sign-in attempt to prevent stale authorization errors (a common MWA pitfall when switching wallets).

### Library: `@wallet-ui/react-native-web3js`

This library wraps the raw MWA Android SDK into a React context. It provides:

- `MobileWalletProvider` — context provider configured with chain, RPC endpoint, and dApp identity
- `useMobileWallet()` — hook exposing `connectAnd`, `disconnect`, `account`, `chain`, `identity`

The dApp identity presented to the wallet:

```ts
{
  name: "Frequencii",
  uri: "https://frequencii.world",
  icon: "https://frequencii.world/favicon.ico",
}
```

---

## 4. Feature Flow — Screen by Screen

### App Shell

The root `App` component wraps everything in `MobileWalletProvider`. The `AppShell` component handles three states:

```
App Launch
    │
    ▼
isRestoring = true  ──► Show spinner ("Restoring session")
    │
    ▼
Restore JWT from SecureStore
    │
    ├── JWT found ──► Show main tab UI
    │
    └── No JWT ──► Show login screen
```

**Tab navigation** (horizontal scrollable tab bar):

| Tab | Screen | Auth Required |
|---|---|---|
| Chat | AgentScreen | Yes |
| Markets | MarketsScreen | Yes |
| Portfolio | PositionsScreen | Yes |
| Privacy | PrivacyScreen | Yes |
| Seeker | SeekerPanel | Yes |
| Profile | ProfileScreen | Yes |

---

### Chat Tab — AI Prediction Agent

**File**: `src/features/agent/AgentScreen.tsx`

The AI agent screen gives users a conversational interface to a prediction market analyst powered by OpenRouter (Minimax M2.5) via SSE streaming.

**Flow:**

```
Screen loads
    │
    ▼
Load trending markets (GET /api/v1/markets?limit=5)
    │
    ▼
User selects market context chip (optional)
    │
    ▼
User types message or taps quick action
    │
    ▼
POST /api/v1/agent/chat
{ message, marketContext?, trendingMarkets?, history }
    │
    ▼
SSE stream opens
    │
    ├── data: { content: "...", done: false }  ──► Append to message bubble
    │
    └── data: { done: true }  ──► Mark message complete
```

**Quick actions** (pre-filled prompts):
- "Top trending markets"
- "What should I watch today?"
- "Explain prediction market risk"
- "Find high-volume crypto markets"

**Market context chips**: User can pin a specific market as context for the AI, or leave it on "Global" for general analysis.

**Streaming**: The `useMobileAgent` hook manages the SSE connection, message history (last 10 messages), and streaming state. The user can tap "Stop" to abort mid-stream.

---

### Markets Tab — Browse & Trade

**File**: `src/features/markets/MarketsScreen.tsx`

**Flow:**

```
Screen loads
    │
    ├── GET /api/v1/watchlist  ──► Load saved market IDs
    │
    └── GET /api/v1/markets?category=All&limit=30  ──► Load market list
         │
         ▼
    Market list renders (FlatList)
         │
         ├── Pull-to-refresh ──► Reload markets
         │
         ├── Category filter pills (All / crypto / politics / sports / economics / culture)
         │
         ├── Search bar + "Go" button ──► GET /api/v1/markets?search=...
         │
         ├── "Save" / "Saved" button ──► POST/DELETE /api/v1/watchlist/:eventId
         │
         └── Tap market row ──► Open MarketDetailModal
                                    │
                                    ├── GET /api/v1/markets/:id  (enrich detail)
                                    │
                                    ├── YES / NO outcome selector
                                    │
                                    ├── Amount input (USDC)
                                    │
                                    └── "Build Trade" button
                                            │
                                            ▼
                                        Alert: "Review trade"
                                            │
                                            └── "Simulate & Sign"
                                                    │
                                                    ▼
                                                POST /api/v1/trade
                                                { marketId, outcome, amount }
                                                    │
                                                    ▼
                                                Alert: tx signature
```

**Trade execution** is handled by `useMobileJupiterPredict` which calls the backend `/api/v1/trade` endpoint. The backend builds and simulates the transaction; the mobile app currently shows the result signature. Full wallet signing of trade transactions is a pending item (see Roadmap).

---

### Portfolio Tab — Positions

**File**: `src/features/positions/PositionsScreen.tsx`

**Flow:**

```
Screen loads
    │
    ▼
GET /api/v1/positions?walletPubkey={address}
    │
    ▼
FlatList of positions
    │
    ├── Each row: market title, outcome, amount, PnL
    │
    └── "Claim" button (if position.claimable)
            │
            ▼
        POST /api/v1/positions/:id/claim
            │
            ▼
        Alert: claim tx signature
        Reload positions
```

---

### Privacy Tab — Privacy Layer Status

**File**: `src/features/privacy/PrivacyScreen.tsx`

This screen documents the migration status of the web privacy features to mobile and provides draft UIs for features not yet fully wired.

**Feature migration status:**

| Feature | Status | Notes |
|---|---|---|
| Ephemeral burner wallet | Ready for native wiring | Needs secure native key storage + wallet-signed encryption |
| PrivacyCash shielded funding | Guarded | PrivacyCash/Light Protocol SDK not yet RN-safe |
| MagicBlock P2P chat | Guarded | Needs RN transaction signer + listener port |
| Private crypto gifts | Draft only | Gift UX present; shielded transfers disabled |

**Draft UIs available:**
- P2P Contacts: Add wallet addresses; MagicBlock send/listen will plug in later
- Crypto Gift Composer: Amount + token input; execution guarded

---

### Seeker Tab — Seeker Device Verification

**File**: `src/features/seeker/SeekerPanel.tsx`

The Seeker is Solana Mobile's Android device. This panel:

1. Detects if the device is a Seeker via `Platform.constants.Model`
2. Calls `GET /api/v1/seeker/verify` to check if the connected wallet holds a **Solana Mobile Genesis Token** (an NFT that grants early-adopter benefits)

**Flow:**

```
Screen loads
    │
    ▼
Read Platform.constants.Model / Manufacturer
    │
    ▼
GET /api/v1/seeker/verify (JWT auth)
    │
    ├── hasGenesisToken: true  ──► "Verified" + show mint address
    │
    └── hasGenesisToken: false ──► "Not found"
```

---

### Profile Tab — Account Management

**File**: `src/features/profile/ProfileScreen.tsx`

**Sections:**

| Section | Actions |
|---|---|
| Profile | Edit display name + avatar URL → PUT /api/v1/user/profile |
| Watchlist | View saved markets; remove items → DELETE /api/v1/watchlist/:id |
| Notifications | Register Android push token → POST /api/v1/user/push-token |
| Session | Refresh JWT (POST /api/v1/auth/refresh) or Sign Out |

---

## 5. Authentication Flow

Authentication is the most complex part of the mobile app because it bridges MWA (wallet signing) with the backend JWT system.

### Full Sign-In Sequence

```
User taps "Connect Wallet"
    │
    ▼
Clear MWA authorization cache (prevent stale auth errors)
Disconnect any existing wallet session
    │
    ▼
Build auth message: "Frequencii Auth: {Date.now()}"
    │
    ▼
wallet.connectAnd(async (mwaWallet) => {
    │
    ├── mwaWallet.authorize({ chain: "solana:mainnet", identity })
    │       └── Wallet opens, user approves
    │           Returns: { accounts: [{ address, addressBase64 }] }
    │
    └── mwaWallet.signMessages({ addresses, payloads: [Buffer(message)] })
            └── Wallet shows signing request, user approves
                Returns: [Uint8Array(64 sig + message)]
})
    │
    ▼
Extract pubkey (base58) + signature (first 64 bytes)
    │
    ▼
POST /api/v1/auth/login
{ pubkey, message, signature: bs58.encode(signature) }
    │
    ▼
Backend verifies ed25519 signature (tweetnacl)
Checks timestamp < 5 minutes old
    │
    ▼
Returns: { token (JWT, 7 days), user }
    │
    ▼
Store token + user in expo-secure-store
Set state: token, user
    │
    ▼
App shell renders main tab UI
```

### Session Restoration

On app launch, the app reads `frequencii_mobile_jwt` from SecureStore. If found, the user is immediately authenticated without re-opening the wallet.

### Error Handling

| Error Type | Detection | Recovery |
|---|---|---|
| User cancelled wallet | `CancellationException` in message | Show "tap Connect Wallet and approve again" |
| Wallet timeout (45s) | Custom timeout wrapper | Show "reopen wallet and approve" |
| Stale MWA authorization | `auth.*token.*(not valid\|invalid\|expired)` | Show "Reset Wallet Session" button |
| Session closed | `TimeoutException\|session closed\|endSession` | Show "Wallet request timed out" |

The "Reset Wallet Session" button clears SecureStore, disconnects the wallet, and resets all auth state — giving the user a clean slate.

---

## 6. API Integration

### Base URL

Configured via `EXPO_PUBLIC_API_BASE_URL` environment variable.

| Environment | URL |
|---|---|
| Android emulator (local) | `http://10.0.2.2:3000` |
| Physical device (local) | `http://{LAN_IP}:3000` |
| Production | `https://www.frequencii.world` |

### `apiRequest` Helper

All API calls go through `src/api/client.ts`:

```ts
apiRequest<T>(path, { method?, body?, token? }): Promise<T>
```

- Automatically sets `Content-Type: application/json` when body is present
- Injects `Authorization: Bearer {token}` when token is provided
- Throws `ApiError` with `status` and `details` on non-2xx responses
- Returns `undefined` for 204 No Content

### Endpoint Usage by Screen

| Screen | Endpoints Called |
|---|---|
| Auth | POST /auth/login, POST /auth/refresh |
| Agent | GET /markets (context), POST /agent/chat (SSE) |
| Markets | GET /markets, GET /markets/:id, POST/DELETE /watchlist/:id |
| Positions | GET /positions, POST /positions/:id/claim |
| Trade | POST /trade |
| Seeker | GET /seeker/verify |
| Profile | GET /user/profile, PUT /user/profile, POST/DELETE /user/push-token, GET /watchlist, DELETE /watchlist/:id |

### SSE Streaming (Agent Chat)

The `useMobileAgent` hook opens a streaming fetch to `/api/v1/agent/chat`. The backend returns `text/event-stream` with JSON chunks:

```
data: {"content": "Based on current...", "done": false}
data: {"content": " odds movement...", "done": false}
data: {"done": true}
```

The hook reads the `ReadableStream` from the fetch response, decodes each chunk, and appends content to the active message bubble in real time.

---

## 7. Privacy Layer — Migration Status

The web app has a fully functional privacy layer (ZK shielded pool + ephemeral burner wallets). The mobile app has the UI scaffolding but the execution is guarded pending native SDK verification.

### What's Live on Mobile

- Main wallet trading via the backend API (no privacy shielding)
- P2P contact address book (local state, no messaging yet)
- Gift composer UI (draft only, no execution)
- Privacy feature status dashboard

### What Needs Native Wiring

**Ephemeral Burner Wallet**

The web implementation uses `useBurnerWallet.ts` which:
1. Signs a PrivacyCash auth message with the main wallet
2. Derives encryption keys from the signature
3. Generates an ephemeral keypair
4. Deposits SOL to the ZK shielded pool (Light Protocol)
5. Withdraws from the pool to the burner address
6. Executes trades from the burner

For mobile, this requires:
- Wallet-signed key derivation (MWA `signMessages` for the PrivacyCash auth message)
- Secure encrypted storage of the ephemeral keypair (SecureStore or Android Keystore)
- Explicit user review + simulation before any mainnet transaction
- Verification that the PrivacyCash/Light Protocol SDK works in React Native

**MagicBlock P2P Chat**

The web implementation uses an Anchor program with delegated PDAs on MagicBlock Ephemeral Rollups. For mobile:
- Need a React Native transaction signer (MWA `signTransactions`)
- Need a WebSocket or polling listener for incoming messages
- The contact model in `PrivacyScreen` is the starting point

---

## 8. Seeker Device Support

The [Solana Seeker](https://solanamobile.com/seeker) is a purpose-built Android phone for Solana. Frequencii has first-class Seeker support:

### Genesis Token Verification

The Seeker Genesis Token is an NFT held by early Seeker device owners. The backend `/api/v1/seeker/verify` endpoint checks if the authenticated wallet holds this token using the Helius mainnet RPC.

### Device Detection

```ts
const constants = Platform.constants as Record<string, unknown>;
const isLikelySeeker = String(constants.Model ?? "") === "Seeker";
```

This is a UI hint only — the actual verification is on-chain via the backend.

### Seeker-Specific Features (Planned)

- Priority access to new prediction markets
- Reduced privacy fees for Genesis Token holders
- Exclusive AI agent capabilities

---

## 9. Tech Stack

| Layer | Library | Version | Purpose |
|---|---|---|---|
| Framework | React Native | 0.83.6 | Native Android UI |
| Build tool | Expo | 55.x | Dev builds, native modules |
| Dev client | expo-dev-client | 55.x | Custom native build (required for MWA) |
| Wallet adapter | @wallet-ui/react-native-web3js | 4.1.0 | MWA React context + hooks |
| Solana web3 | @solana/web3.js | 1.98.4 | PublicKey, transaction types |
| Solana kit | @solana/kit | 6.9.0 | Modern Solana primitives |
| Secure storage | expo-secure-store | 55.x | JWT + MWA auth cache |
| Crypto | react-native-quick-crypto | 1.1.2 | Native crypto polyfill |
| Base58 | bs58 | 6.0.0 | Signature encoding |
| Buffer | buffer | 6.0.3 | Node.js Buffer polyfill |
| Language | TypeScript | 5.9.x | Type safety |

### Why `expo-dev-client` is Required

Expo Go does not include the native MWA modules. A custom development build is required. This is a one-time `expo run:android` step that installs the APK with all native dependencies.

---

## 10. Project Structure

```
apps/mobile/
├── index.js                    # Expo entry point
├── app.json                    # Expo config (name, bundle ID, etc.)
├── metro.config.js             # Metro bundler config
├── polyfill.js                 # Global polyfills (Buffer, crypto)
├── package.json
├── tsconfig.json
│
├── src/
│   ├── App.tsx                 # Root component + tab navigation
│   │
│   ├── api/
│   │   └── client.ts           # apiRequest helper + ApiError
│   │
│   ├── config/
│   │   └── env.ts              # API_BASE_URL, SOLANA_CHAIN, SOLANA_RPC_URL
│   │
│   ├── solana/
│   │   ├── MobileWalletProvider.tsx   # Wraps @wallet-ui MobileWalletProvider
│   │   ├── authorizationCache.ts      # MWA auth token persistence (SecureStore)
│   │   └── useFrequenciiWallet.ts     # Extends useMobileWallet with address helper
│   │
│   └── features/
│       ├── auth/
│       │   └── useMobileAuth.ts       # Full sign-in/out/restore/refresh logic
│       │
│       ├── agent/
│       │   ├── AgentScreen.tsx        # AI chat UI
│       │   └── useMobileAgent.ts      # SSE streaming hook
│       │
│       ├── markets/
│       │   └── MarketsScreen.tsx      # Market list + detail modal + trade
│       │
│       ├── positions/
│       │   └── PositionsScreen.tsx    # Portfolio + claim
│       │
│       ├── privacy/
│       │   └── PrivacyScreen.tsx      # Privacy layer status + draft UIs
│       │
│       ├── seeker/
│       │   └── SeekerPanel.tsx        # Genesis Token verification
│       │
│       ├── profile/
│       │   └── ProfileScreen.tsx      # Profile, watchlist, push tokens, session
│       │
│       └── trade/
│           └── useMobileJupiterPredict.ts  # Trade + claim API calls
│
└── android/                    # Native Android project (auto-generated by Expo)
```

---

## 11. Environment Configuration

Environment variables are set via `EXPO_PUBLIC_*` prefix (Expo's public env convention).

| Variable | Default | Description |
|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `https://www.frequencii.world` | Backend API base URL |
| `EXPO_PUBLIC_SOLANA_CHAIN` | `solana:mainnet` | Solana chain identifier for MWA |
| `EXPO_PUBLIC_SOLANA_RPC_URL` | `https://api.mainnet-beta.solana.com` | Solana RPC endpoint |

For local development against the emulator:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 pnpm mobile:android
```

For a physical device on the same LAN:

```bash
EXPO_PUBLIC_API_BASE_URL=http://192.168.1.x:3000 pnpm mobile:android
```

---

## 12. Development Setup

### Prerequisites

- Node.js >= 18
- pnpm
- Android Studio + Android SDK (API 33+)
- An Android emulator or physical Android device
- An MWA-compatible wallet installed on the device/emulator (Phantom, Solflare, or the [Solana Mobile Mock MWA Wallet](https://github.com/solana-mobile/mock-mwa-wallet) for testing)

### First-Time Setup

```bash
# From repo root
pnpm install

# Start the Next.js backend
pnpm dev

# In a separate terminal, build and run the Android app
cd apps/mobile
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 pnpm android
```

The first `pnpm android` compiles the native Android project and installs the APK. Subsequent runs use `expo start --dev-client` for fast JS reloads.

### Testing Wallet Flows

1. Install the [Solana Mobile Mock MWA Wallet](https://github.com/solana-mobile/mock-mwa-wallet) APK on your emulator for testing without a real wallet
2. For mainnet testing, install Phantom on a physical Android device
3. For Seeker-specific testing, use a Seeker device or set `Platform.constants.Model = "Seeker"` in a test build

### Running Against Production API

```bash
# Default — no env override needed
pnpm android
# or explicitly:
EXPO_PUBLIC_API_BASE_URL=https://www.frequencii.world pnpm android
```

---

## 13. Roadmap & Gaps

### Currently Working ✅

| Feature | Status |
|---|---|
| MWA wallet connect + authorize | ✅ Live |
| JWT authentication (sign message → login) | ✅ Live |
| Session persistence (SecureStore) | ✅ Live |
| Session restore on app launch | ✅ Live |
| AI agent chat with SSE streaming | ✅ Live |
| Market browsing (list, search, filter) | ✅ Live |
| Market detail view | ✅ Live |
| Watchlist (save/remove markets) | ✅ Live |
| Portfolio / positions view | ✅ Live |
| Trade building (via backend) | ✅ Live |
| Payout claiming | ✅ Live |
| Profile management | ✅ Live |
| Push token registration | ✅ Live |
| Seeker Genesis Token verification | ✅ Live |
| Privacy layer status dashboard | ✅ Live |

### Pending / In Progress 🔧

| Feature | Blocker | Priority |
|---|---|---|
| Trade transaction signing via MWA | Need `signTransactions` wired to trade flow | High |
| Ephemeral burner wallet (mobile) | PrivacyCash SDK RN compatibility + secure key storage | High |
| PrivacyCash shielded funding | Light Protocol SDK RN verification | High |
| MagicBlock P2P chat | RN transaction signer + WebSocket listener | Medium |
| Private crypto gifts | Depends on PrivacyCash mobile | Medium |
| FCM push notifications | Native FCM module integration | Medium |
| iOS support | MWA is Android-only; iOS needs WalletConnect | Low |

### Trade Signing Gap (Important)

Currently, `useMobileJupiterPredict` calls the backend to build a trade transaction but does not sign it via MWA. The full flow should be:

```
POST /api/v1/trade  ──► Returns: { transaction: base64 }
    │
    ▼
Deserialize transaction
    │
    ▼
wallet.connectAnd(async (mwaWallet) => {
    mwaWallet.signTransactions({ transactions: [tx] })
})
    │
    ▼
Submit signed transaction to Solana via backend or direct RPC
    │
    ▼
Return signature to user
```

This is the next critical implementation task for the mobile trading flow.

### iOS Considerations

MWA is Android-only. For iOS, the Solana Mobile ecosystem recommends using **WalletConnect** (via Reown). The web app already has `NEXT_PUBLIC_REOWN_PROJECT_ID` configured. Adding iOS support would require:

1. Adding `@walletconnect/react-native-compat` and related packages
2. Implementing a WalletConnect-based auth flow alongside the MWA flow
3. Platform-conditional rendering in `MobileWalletProvider`

---

## References

- [Solana Mobile Docs](https://docs.solanamobile.com)
- [Mobile Wallet Adapter Protocol](https://docs.solanamobile.com/get-started/mobile-wallet-adapter)
- [@wallet-ui/react-native-web3js](https://github.com/wallet-ui/wallet-ui)
- [Expo Dev Client](https://docs.expo.dev/develop/development-builds/introduction/)
- [Light Protocol](https://lightprotocol.com)
- [MagicBlock Ephemeral Rollups](https://magicblock.gg)
- [Jupiter Prediction API](https://station.jup.ag/docs)
- [Frequencii REST API Docs](https://www.frequencii.world/api/v1/docs)

---

*Frequencii Mobile — private prediction markets, wired for Solana Mobile.*

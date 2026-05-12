# Solana Mobile React Native Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a React Native Android client for Frequencii that supports Solana Mobile Seeker users through Mobile Wallet Adapter while keeping the existing Next.js app as the web app and backend API.

**Architecture:** Keep the current root Next.js app in place, add `apps/mobile` as an Expo React Native app, and share only platform-safe types/API clients through `packages/shared`. Wallet, storage, crypto, and transaction signing stay behind platform-specific adapters so browser APIs do not leak into mobile code.

**Tech Stack:** Expo React Native, Android custom development build, `@wallet-ui/react-native-web3js`, `@solana/web3.js`, `react-native-quick-crypto`, Mobile Wallet Adapter, Next.js API v1, Helius RPC, Token-2022, Seeker Genesis Token.

---

## Official Docs Checked

- Solana Mobile create project: https://docs.solanamobile.com/get-started/react-native/create-solana-mobile-app
- React Native MWA installation: https://docs.solanamobile.com/get-started/react-native/installation
- React Native MWA setup: https://docs.solanamobile.com/get-started/react-native/setup
- React Native MWA quickstart: https://docs.solanamobile.com/get-started/react-native/quickstart
- MWA platform support: https://docs.solanamobile.com/mobile-wallet-adapter/mobile-apps
- Seeker detection: https://docs.solanamobile.com/recipes/general/detecting-seeker-users
- Seeker Genesis Token: https://docs.solanamobile.com/marketing/engaging-seeker-users
- Android testing: https://docs.solanamobile.com/recipes/general/test-with-any-android-device
- Anchor integration: https://docs.solanamobile.com/recipes/solana-development/anchor-integration

## Current Repo Facts

- Root app is Next.js and should remain the backend/web app.
- Existing API v1 already exposes mobile-friendly endpoints under `src/app/api/v1`.
- Production API docs are available at `https://www.frequencii.world/api/v1/docs`.
- Production API base URL for the mobile client is `https://www.frequencii.world`.
- Current wallet code is browser-oriented: `@reown/appkit`, `@solana/wallet-adapter-react`, `localStorage`, `window`, and `crypto.subtle`.
- Current Solana transaction code uses `@solana/web3.js` and server-built base64 transactions from `/api/jupiter`.
- Current Anchor dependency is `@coral-xyz/anchor@0.32.1`; Solana Mobile docs caution React Native apps to use Anchor `0.28.0` due to polyfill issues. Avoid bringing Anchor into mobile until the chat/MagicBlock feature is ported.
- `JWT_SECRET` is server-only. Never store it in `apps/mobile`, `EXPO_PUBLIC_*`, committed docs, or bundled client code.
- Current branch for this work: `codex/solana-mobile-react-native`.

## File Structure Target

- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/index.js`
- Create: `apps/mobile/polyfill.js`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/src/App.tsx`
- Create: `apps/mobile/src/config/env.ts`
- Create: `apps/mobile/src/solana/MobileWalletProvider.tsx`
- Create: `apps/mobile/src/solana/useFrequenciiWallet.ts`
- Create: `apps/mobile/src/seeker/useSeekerDevice.ts`
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/features/auth/useMobileAuth.ts`
- Create: `apps/mobile/src/features/markets/MarketsScreen.tsx`
- Create: `apps/mobile/src/features/trade/useMobileJupiterPredict.ts`
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/api.ts`
- Create: `src/lib/api/seeker.ts`
- Create: `src/app/api/v1/seeker/verify/route.ts`
- Modify: `src/lib/api/openapi.ts`
- Modify: `.env.example`
- Modify: `README.md`

## Task 1: Workspace Baseline

**Files:**
- Modify: `pnpm-workspace.yaml`
- Modify: `package.json`

- [ ] **Step 1: Confirm branch and dirty baseline**

Run:

```bash
git status --short --branch
```

Expected: branch is `codex/solana-mobile-react-native`. If unrelated dirty files exist, do not revert them.

- [ ] **Step 2: Update pnpm workspace packages**

Change `pnpm-workspace.yaml` to include workspaces while preserving the current `onlyBuiltDependencies` list:

```yaml
packages:
  - "."
  - "apps/*"
  - "packages/*"

onlyBuiltDependencies:
  - '@biomejs/biome'
  - '@parcel/watcher'
  - '@reown/appkit'
  - '@stellar/stellar-sdk'
  - better-sqlite3
  - bigint-buffer
  - blake-hash
  - bufferutil
  - protobufjs
  - sharp
  - tiny-secp256k1
  - usb
  - utf-8-validate
```

- [ ] **Step 3: Add root scripts**

Add these scripts to root `package.json`:

```json
{
  "mobile": "pnpm --dir apps/mobile start",
  "mobile:android": "pnpm --dir apps/mobile android",
  "mobile:typecheck": "pnpm --dir apps/mobile typecheck"
}
```

- [ ] **Step 4: Verify workspace parsing**

Run:

```bash
pnpm -w list --depth 0
```

Expected: root package is listed. Mobile/shared packages may appear after later tasks.

- [ ] **Step 5: Commit workspace baseline**

```bash
git add pnpm-workspace.yaml package.json
git commit -m "chore: prepare workspace for mobile app"
```

## Task 2: Shared Platform-Safe Package

**Files:**
- Create: `packages/shared/package.json`
- Create: `packages/shared/src/index.ts`
- Create: `packages/shared/src/types.ts`
- Create: `packages/shared/src/api.ts`

- [ ] **Step 1: Create shared package manifest**

Create `packages/shared/package.json`:

```json
{
  "name": "@frequencii/shared",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "main": "./src/index.ts",
  "types": "./src/index.ts"
}
```

- [ ] **Step 2: Add shared market and position types**

Create `packages/shared/src/types.ts`:

```ts
export type TradeOutcome = "YES" | "NO";

export interface PredictionMarket {
  id: string;
  question: string;
  slug: string;
  outcomes: string[];
  outcomePrices: number[];
  volume: number;
  endDate: string;
  startDate: string;
  active: boolean;
  closed: boolean;
  image: string;
  description: string;
  category: string;
  lastTradePrice: number;
  oneDayPriceChange: number;
}

export interface PredictionEvent {
  id: string;
  title: string;
  slug: string;
  description: string;
  category: string;
  image: string;
  volume: number;
  active: boolean;
  closed: boolean;
  startDate: string;
  endDate: string;
  markets: PredictionMarket[];
  volume24hr?: number;
}

export interface Position {
  marketId: string;
  marketTitle: string;
  outcome: TradeOutcome;
  entryPrice: number;
  currentPrice: number;
  amount: number;
  pnl: number;
  pnlPercent: number;
  resolved: boolean;
  claimable: boolean;
}
```

- [ ] **Step 3: Add shared API response helpers**

Create `packages/shared/src/api.ts`:

```ts
import type { PredictionEvent, Position } from "./types";

export interface MarketsResponse {
  events: PredictionEvent[];
  total: number;
  hasMore: boolean;
}

export interface LoginResponse {
  token: string;
  user: {
    pubkey: string;
    displayName: string;
    avatar: string;
  };
}

export interface PositionsResponse {
  positions: Position[];
}
```

- [ ] **Step 4: Export package API**

Create `packages/shared/src/index.ts`:

```ts
export * from "./api";
export * from "./types";
```

- [ ] **Step 5: Verify TypeScript source is syntax-valid**

Run:

```bash
npx tsc --noEmit --skipLibCheck packages/shared/src/index.ts
```

Expected: no syntax errors.

- [ ] **Step 6: Commit shared package**

```bash
git add packages/shared
git commit -m "feat: add shared mobile-safe types"
```

## Task 3: Expo Mobile App Scaffold

**Files:**
- Create: `apps/mobile/package.json`
- Create: `apps/mobile/app.json`
- Create: `apps/mobile/index.js`
- Create: `apps/mobile/polyfill.js`
- Create: `apps/mobile/tsconfig.json`
- Create: `apps/mobile/src/App.tsx`
- Create: `apps/mobile/src/config/env.ts`

- [ ] **Step 1: Create mobile package manifest**

Create `apps/mobile/package.json`:

```json
{
  "name": "@frequencii/mobile",
  "version": "0.1.0",
  "private": true,
  "main": "./index.js",
  "scripts": {
    "start": "expo start --dev-client",
    "android": "expo run:android",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@frequencii/shared": "workspace:*",
    "@solana/web3.js": "^1.98.4",
    "@wallet-ui/react-native-web3js": "latest",
    "bs58": "^6.0.0",
    "buffer": "^6.0.3",
    "expo": "latest",
    "expo-dev-client": "latest",
    "expo-secure-store": "latest",
    "react": "latest",
    "react-native": "latest",
    "react-native-quick-crypto": "latest"
  },
  "devDependencies": {
    "@types/react": "latest",
    "typescript": "^5.8.2"
  }
}
```

- [ ] **Step 2: Add Expo config**

Create `apps/mobile/app.json`:

```json
{
  "expo": {
    "name": "Frequencii",
    "slug": "frequencii-mobile",
    "scheme": "frequencii",
    "version": "0.1.0",
    "orientation": "portrait",
    "userInterfaceStyle": "dark",
    "android": {
      "package": "world.frequencii.mobile"
    },
    "plugins": [
      "expo-secure-store"
    ]
  }
}
```

- [ ] **Step 3: Add Solana web3 crypto polyfill**

Create `apps/mobile/polyfill.js`:

```js
import { install } from "react-native-quick-crypto";
import { Buffer } from "buffer";

install();
global.Buffer = Buffer;
```

- [ ] **Step 4: Import polyfill before app code**

Create `apps/mobile/index.js`:

```js
import "./polyfill";
import { registerRootComponent } from "expo";
import App from "./src/App";

registerRootComponent(App);
```

- [ ] **Step 5: Add mobile TypeScript config**

Create `apps/mobile/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.json",
  "compilerOptions": {
    "allowJs": true,
    "jsx": "react-jsx",
    "noEmit": true,
    "types": ["react"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "index.js", "polyfill.js"]
}
```

- [ ] **Step 6: Add environment reader**

Create `apps/mobile/src/config/env.ts`:

```ts
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://www.frequencii.world";

export const SOLANA_CHAIN =
  process.env.EXPO_PUBLIC_SOLANA_CHAIN ?? "solana:devnet";

export const SOLANA_RPC_URL =
  process.env.EXPO_PUBLIC_SOLANA_RPC_URL ?? "https://api.devnet.solana.com";
```

- [ ] **Step 7: Add placeholder app shell**

Create `apps/mobile/src/App.tsx`:

```tsx
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, Text, View } from "react-native";

export default function App() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070907" }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "#f4f7ef", fontSize: 28, fontWeight: "700" }}>
          Frequencii
        </Text>
        <Text style={{ color: "#aab3a3", marginTop: 8, fontSize: 16 }}>
          Private prediction markets for Solana Mobile.
        </Text>
      </View>
    </SafeAreaView>
  );
}
```

- [ ] **Step 8: Install dependencies**

Run:

```bash
pnpm install
```

Expected: lockfile updates and `apps/mobile` package resolves.

- [ ] **Step 9: Typecheck mobile scaffold**

Run:

```bash
pnpm mobile:typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 10: Commit mobile scaffold**

```bash
git add apps/mobile package.json pnpm-lock.yaml pnpm-workspace.yaml
git commit -m "feat: scaffold solana mobile app"
```

## Task 4: Mobile Wallet Adapter Provider

**Files:**
- Create: `apps/mobile/src/solana/MobileWalletProvider.tsx`
- Create: `apps/mobile/src/solana/useFrequenciiWallet.ts`
- Modify: `apps/mobile/src/App.tsx`

- [ ] **Step 1: Add provider wrapper**

Create `apps/mobile/src/solana/MobileWalletProvider.tsx`:

```tsx
import { MobileWalletProvider as SolanaMobileWalletProvider } from "@wallet-ui/react-native-web3js";
import type { ReactNode } from "react";
import { SOLANA_CHAIN, SOLANA_RPC_URL } from "../config/env";

const identity = {
  name: "Frequencii",
  uri: "https://frequencii.world",
  icon: "favicon.ico",
};

export function MobileWalletProvider({ children }: { children: ReactNode }) {
  return (
    <SolanaMobileWalletProvider
      chain={SOLANA_CHAIN}
      endpoint={SOLANA_RPC_URL}
      identity={identity}
    >
      {children}
    </SolanaMobileWalletProvider>
  );
}
```

- [ ] **Step 2: Add wallet facade hook**

Create `apps/mobile/src/solana/useFrequenciiWallet.ts`:

```ts
import { useMobileWallet } from "@wallet-ui/react-native-web3js";

export function useFrequenciiWallet() {
  const wallet = useMobileWallet();
  const address = wallet.account?.address ?? null;

  return {
    ...wallet,
    address,
    isConnected: Boolean(address),
  };
}
```

- [ ] **Step 3: Wrap app with mobile wallet provider**

Update `apps/mobile/src/App.tsx`:

```tsx
import { StatusBar } from "expo-status-bar";
import { SafeAreaView, Text, View } from "react-native";
import { MobileWalletProvider } from "./solana/MobileWalletProvider";

function AppShell() {
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#070907" }}>
      <StatusBar style="light" />
      <View style={{ flex: 1, justifyContent: "center", padding: 24 }}>
        <Text style={{ color: "#f4f7ef", fontSize: 28, fontWeight: "700" }}>
          Frequencii
        </Text>
        <Text style={{ color: "#aab3a3", marginTop: 8, fontSize: 16 }}>
          Private prediction markets for Solana Mobile.
        </Text>
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <MobileWalletProvider>
      <AppShell />
    </MobileWalletProvider>
  );
}
```

- [ ] **Step 4: Typecheck wallet provider**

Run:

```bash
pnpm mobile:typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit wallet provider**

```bash
git add apps/mobile/src
git commit -m "feat: add mobile wallet adapter provider"
```

## Task 5: Mobile Auth Against Existing API

**Files:**
- Create: `apps/mobile/src/api/client.ts`
- Create: `apps/mobile/src/features/auth/useMobileAuth.ts`
- Modify: `apps/mobile/src/App.tsx`

- [ ] **Step 1: Add API client**

Create `apps/mobile/src/api/client.ts`:

```ts
import { API_BASE_URL } from "../config/env";

export async function apiRequest<T>(
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json");
  if (init.token) {
    headers.set("Authorization", `Bearer ${init.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`API ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}
```

- [ ] **Step 2: Confirm backend JWT configuration**

Confirm the deployed backend has `JWT_SECRET` set in its server environment. Do not put this value in Expo config, React Native source, or any `EXPO_PUBLIC_*` variable.

- [ ] **Step 3: Add auth hook**

Create `apps/mobile/src/features/auth/useMobileAuth.ts`:

```ts
import type { LoginResponse } from "@frequencii/shared";
import bs58 from "bs58";
import { useState } from "react";
import { apiRequest } from "../../api/client";
import { useFrequenciiWallet } from "../../solana/useFrequenciiWallet";

export function useMobileAuth() {
  const wallet = useFrequenciiWallet();
  const [token, setToken] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function signIn() {
    if (!wallet.address) {
      await wallet.connect();
    }

    const pubkey = wallet.account?.address;
    if (!pubkey) {
      throw new Error("Wallet connection did not return an address");
    }

    setIsSigningIn(true);
    try {
      const message = `Frequencii Auth: ${Date.now()}`;
      const encoded = new TextEncoder().encode(message);
      const signature = await wallet.signMessage(encoded);
      const response = await apiRequest<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          pubkey,
          message,
          signature: bs58.encode(signature),
        }),
      });
      setToken(response.token);
      return response;
    } finally {
      setIsSigningIn(false);
    }
  }

  return {
    token,
    isSigningIn,
    signIn,
    wallet,
  };
}
```

- [ ] **Step 4: Confirm server signature format before wiring UI**

Run:

```bash
sed -n '1,220p' src/app/api/v1/auth/login/route.ts
```

Expected: API expects base58 signatures through `verifyWalletSignature` in `src/lib/api/auth.ts`. Keep `bs58.encode(signature)`.

- [ ] **Step 5: Typecheck auth hook**

Run:

```bash
pnpm mobile:typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 6: Commit mobile auth**

```bash
git add apps/mobile/src
git commit -m "feat: add mobile wallet auth"
```

## Task 6: Seeker Device And SGT Support

**Files:**
- Create: `apps/mobile/src/seeker/useSeekerDevice.ts`
- Create: `src/lib/api/seeker.ts`
- Create: `src/app/api/v1/seeker/verify/route.ts`
- Modify: `src/lib/api/openapi.ts`
- Modify: `.env.example`

- [ ] **Step 1: Add lightweight Seeker device hook**

Create `apps/mobile/src/seeker/useSeekerDevice.ts`:

```ts
import { Platform } from "react-native";

export function useSeekerDevice() {
  const constants = Platform.constants as Record<string, unknown>;
  const model = String(constants.Model ?? "");
  const manufacturer = String(constants.Manufacturer ?? "");

  return {
    isLikelySeeker: model === "Seeker",
    model,
    manufacturer,
  };
}
```

- [ ] **Step 2: Add backend SGT verifier**

Create `src/lib/api/seeker.ts`:

```ts
import { Connection, PublicKey } from "@solana/web3.js";
import {
  getMetadataPointerState,
  getTokenGroupMemberState,
  TOKEN_2022_PROGRAM_ID,
  unpackMint,
} from "@solana/spl-token";

const SGT_MINT_AUTHORITY = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";
const SGT_METADATA_ADDRESS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const SGT_GROUP_MINT_ADDRESS = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";
const TOKEN_2022_PROGRAM = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";

export interface SeekerVerificationResult {
  hasGenesisToken: boolean;
  genesisTokenMint: string | null;
}

export async function verifySeekerGenesisToken(
  walletAddress: string,
): Promise<SeekerVerificationResult> {
  const rpcUrl = process.env.HELIUS_MAINNET_RPC_URL;
  if (!rpcUrl) {
    throw new Error("HELIUS_MAINNET_RPC_URL is required for SGT verification");
  }

  const owner = new PublicKey(walletAddress);
  const connection = new Connection(rpcUrl, "confirmed");
  let paginationKey: string | undefined;
  const mintPubkeys: PublicKey[] = [];

  do {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "frequencii-sgt-check",
        method: "getTokenAccountsByOwnerV2",
        params: [
          owner.toBase58(),
          { programId: TOKEN_2022_PROGRAM },
          {
            encoding: "jsonParsed",
            limit: 1000,
            ...(paginationKey ? { paginationKey } : {}),
          },
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`Helius SGT query failed: ${response.status}`);
    }

    const data = await response.json();
    if (data.error) {
      throw new Error(`Helius SGT query error: ${data.error.message}`);
    }

    const accounts = data.result?.value?.accounts ?? [];
    for (const accountInfo of accounts) {
      const mint = accountInfo?.account?.data?.parsed?.info?.mint;
      if (typeof mint === "string") {
        mintPubkeys.push(new PublicKey(mint));
      }
    }

    paginationKey = data.result?.paginationKey;
  } while (paginationKey);

  for (let i = 0; i < mintPubkeys.length; i += 100) {
    const batch = mintPubkeys.slice(i, i + 100);
    const infos = await connection.getMultipleAccountsInfo(batch);

    for (let j = 0; j < infos.length; j += 1) {
      const info = infos[j];
      if (!info) continue;

      const mintPubkey = batch[j];
      const mint = unpackMint(mintPubkey, info, TOKEN_2022_PROGRAM_ID);
      const metadata = getMetadataPointerState(mint);
      const group = getTokenGroupMemberState(mint);

      const matchesAuthority = mint.mintAuthority?.toBase58() === SGT_MINT_AUTHORITY;
      const matchesMetadata =
        metadata?.authority?.toBase58() === SGT_MINT_AUTHORITY &&
        metadata?.metadataAddress?.toBase58() === SGT_METADATA_ADDRESS;
      const matchesGroup = group?.group?.toBase58() === SGT_GROUP_MINT_ADDRESS;

      if (matchesAuthority && matchesMetadata && matchesGroup) {
        return {
          hasGenesisToken: true,
          genesisTokenMint: mintPubkey.toBase58(),
        };
      }
    }
  }

  return {
    hasGenesisToken: false,
    genesisTokenMint: null,
  };
}
```

- [ ] **Step 3: Install server dependency**

Run:

```bash
pnpm add @solana/spl-token
```

Expected: root package gets `@solana/spl-token` because the verifier runs in Next.js API routes.

- [ ] **Step 4: Add verify route**

Create `src/app/api/v1/seeker/verify/route.ts`:

```ts
import { NextRequest } from "next/server";
import { isAuthError, withAuth } from "@/lib/api/auth";
import { handlePreflight, jsonResponse } from "@/lib/api/cors";
import { verifySeekerGenesisToken } from "@/lib/api/seeker";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  const authResult = await withAuth(request);
  if (isAuthError(authResult)) return authResult;

  try {
    const result = await verifySeekerGenesisToken(authResult.pubkey);
    return jsonResponse(result, 200, origin);
  } catch (error: any) {
    return jsonResponse(
      { error: "Failed to verify Seeker ownership", details: error.message },
      500,
      origin,
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}
```

- [ ] **Step 5: Add env variable**

Add to `.env.example`:

```bash
HELIUS_MAINNET_RPC_URL=https://mainnet.helius-rpc.com/?api-key=your-helius-api-key
```

- [ ] **Step 6: Add OpenAPI entry**

Update `src/lib/api/openapi.ts` with `GET /api/v1/seeker/verify`, authenticated by bearer token, returning:

```json
{
  "hasGenesisToken": true,
  "genesisTokenMint": "..."
}
```

- [ ] **Step 7: Typecheck web app**

Run:

```bash
pnpm build
```

Expected: Next.js build succeeds. If static export or route runtime issues appear, note the exact failing route and fix before continuing.

- [ ] **Step 8: Commit Seeker support**

```bash
git add apps/mobile/src/seeker src/lib/api/seeker.ts src/app/api/v1/seeker/verify src/lib/api/openapi.ts .env.example package.json pnpm-lock.yaml
git commit -m "feat: verify solana seeker ownership"
```

## Task 7: Markets And API Screens

**Files:**
- Create: `apps/mobile/src/features/markets/MarketsScreen.tsx`
- Modify: `apps/mobile/src/App.tsx`

- [ ] **Step 1: Add market list screen**

Create `apps/mobile/src/features/markets/MarketsScreen.tsx`:

```tsx
import type { MarketsResponse } from "@frequencii/shared";
import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Text, View } from "react-native";
import { apiRequest } from "../../api/client";

export function MarketsScreen({ token }: { token: string }) {
  const [data, setData] = useState<MarketsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    apiRequest<MarketsResponse>("/api/v1/markets?limit=20", { token })
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  if (error) {
    return <Text style={{ color: "#ff9f8f" }}>{error}</Text>;
  }

  if (!data) {
    return <ActivityIndicator color="#d4ff62" />;
  }

  return (
    <FlatList
      data={data.events}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => (
        <View style={{ borderBottomColor: "#243020", borderBottomWidth: 1, paddingVertical: 16 }}>
          <Text style={{ color: "#f4f7ef", fontSize: 16, fontWeight: "700" }}>
            {item.title}
          </Text>
          <Text style={{ color: "#aab3a3", marginTop: 4 }}>
            ${item.volume.toLocaleString()} volume
          </Text>
        </View>
      )}
    />
  );
}
```

- [ ] **Step 2: Wire auth and markets into app shell**

Update `apps/mobile/src/App.tsx` to use `useMobileAuth`, show a connect/sign-in button, and render `MarketsScreen` after token is available.

- [ ] **Step 3: Run local backend**

Run:

```bash
pnpm dev
```

Expected: Next backend is available on `http://localhost:3000`. Android emulator uses `http://10.0.2.2:3000`.

- [ ] **Step 4: Run mobile typecheck**

Run:

```bash
pnpm mobile:typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit markets screen**

```bash
git add apps/mobile/src
git commit -m "feat: add mobile market browsing"
```

## Task 8: Trade Flow Adapter

**Files:**
- Create: `apps/mobile/src/features/trade/useMobileJupiterPredict.ts`

- [ ] **Step 1: Add mobile trade adapter**

Create `apps/mobile/src/features/trade/useMobileJupiterPredict.ts`:

```ts
import { Transaction } from "@solana/web3.js";
import { useState } from "react";
import { apiRequest } from "../../api/client";
import { useFrequenciiWallet } from "../../solana/useFrequenciiWallet";

export function useMobileJupiterPredict(token: string) {
  const wallet = useFrequenciiWallet();
  const [isTrading, setIsTrading] = useState(false);

  async function openPosition(params: {
    marketId: string;
    outcome: "YES" | "NO";
    amount: number;
  }) {
    if (!wallet.account?.address) {
      throw new Error("Connect wallet before trading");
    }

    setIsTrading(true);
    try {
      const build = await apiRequest<{ transaction: string }>("/api/v1/trade", {
        method: "POST",
        token,
        body: JSON.stringify({
          marketId: params.marketId,
          outcome: params.outcome,
          amount: params.amount,
          walletPubkey: wallet.account.address,
        }),
      });

      const transaction = Transaction.from(Buffer.from(build.transaction, "base64"));
      const simulation = await wallet.connection.simulateTransaction(transaction);
      if (simulation.value.err) {
        throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
      }

      return wallet.signAndSendTransaction(transaction);
    } finally {
      setIsTrading(false);
    }
  }

  return {
    isTrading,
    openPosition,
  };
}
```

- [ ] **Step 2: Confirm API route request body**

Run:

```bash
sed -n '1,220p' src/app/api/v1/trade/route.ts
```

Expected: route accepts the same fields used by `useMobileJupiterPredict`. If it requires a different shape, update the hook.

- [ ] **Step 3: Add explicit confirmation UI before calling openPosition**

In the screen that calls `openPosition`, show market title, outcome, SOL amount, fee payer, and cluster before invoking the hook. Do not send transactions without a visible user action.

- [ ] **Step 4: Typecheck trade adapter**

Run:

```bash
pnpm mobile:typecheck
```

Expected: no TypeScript errors.

- [ ] **Step 5: Commit trade adapter**

```bash
git add apps/mobile/src/features/trade
git commit -m "feat: add mobile jupiter trade adapter"
```

## Task 9: Privacy And Burner Wallet Mobile Port

**Files:**
- Create: `apps/mobile/src/privacy/mobileStorage.ts`
- Create: `apps/mobile/src/privacy/useMobileBurnerWallet.ts`
- Create: `apps/mobile/src/privacy/useMobilePrivacyCash.ts`

- [ ] **Step 1: Add secure storage adapter**

Create `apps/mobile/src/privacy/mobileStorage.ts`:

```ts
import * as SecureStore from "expo-secure-store";

export const mobileStorage = {
  async getItem(key: string) {
    return SecureStore.getItemAsync(key);
  },
  async setItem(key: string, value: string) {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  },
  async removeItem(key: string) {
    await SecureStore.deleteItemAsync(key);
  },
};
```

- [ ] **Step 2: Port burner wallet with mobile storage**

Create `apps/mobile/src/privacy/useMobileBurnerWallet.ts` by copying the logic shape from `src/lib/hooks/useBurnerWallet.ts`, replacing:

```ts
localStorage.getItem(STORAGE_KEY)
localStorage.setItem(STORAGE_KEY, JSON.stringify(storagePayload))
localStorage.removeItem(STORAGE_KEY)
```

with:

```ts
await mobileStorage.getItem(STORAGE_KEY)
await mobileStorage.setItem(STORAGE_KEY, JSON.stringify(storagePayload))
await mobileStorage.removeItem(STORAGE_KEY)
```

Use `wallet.signMessage` from `useFrequenciiWallet` for encryption key derivation.

- [ ] **Step 3: Validate PrivacyCash compatibility**

Try importing PrivacyCash in `apps/mobile/src/privacy/useMobilePrivacyCash.ts`. If the SDK requires DOM, `window`, browser storage, or unsupported WASM behavior, keep PrivacyCash operations on the backend or postpone this feature behind a disabled mobile feature flag.

- [ ] **Step 4: Typecheck privacy code**

Run:

```bash
pnpm mobile:typecheck
```

Expected: either typecheck passes, or PrivacyCash incompatibility is documented in `README.md` with the feature disabled.

- [ ] **Step 5: Commit privacy port**

```bash
git add apps/mobile/src/privacy README.md
git commit -m "feat: start mobile privacy wallet port"
```

## Task 10: Android Build And Seeker QA

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Document Android setup**

Add a README section:

````markdown
## Mobile Development

Run the Next.js backend:

```bash
pnpm dev
```

Run the Android client:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 pnpm mobile:android
```

Run against production API:

```bash
EXPO_PUBLIC_API_BASE_URL=https://www.frequencii.world pnpm mobile:android
```

For a physical Android device, replace `10.0.2.2` with the machine LAN IP.
MWA requires a custom development build and an MWA-compatible wallet. Expo Go is not supported for this flow.
````

- [ ] **Step 2: Build Android app**

Run:

```bash
EXPO_PUBLIC_API_BASE_URL=http://10.0.2.2:3000 pnpm mobile:android
```

Expected: Android app launches on emulator or connected Android device.

- [ ] **Step 3: Test with Mock MWA Wallet**

Install the Mock MWA Wallet from the Solana Mobile docs. Verify:

```text
1. Connect wallet opens MWA flow.
2. Sign-in produces a JWT from /api/v1/auth/login.
3. Markets load from /api/v1/markets.
4. Seeker UI flag is false on a normal emulator.
5. SGT verification endpoint returns a deterministic true/false response for the signed-in wallet.
```

- [ ] **Step 4: Test on Seeker**

On a Seeker device, verify:

```text
1. Platform constants report Model = Seeker.
2. Seed Vault Wallet or supported MWA wallet can authorize the app.
3. SIWS or message signing succeeds.
4. SGT verification succeeds only when the connected wallet owns the Seeker Genesis Token.
5. Transaction simulation runs before submit.
```

- [ ] **Step 5: Commit docs and QA notes**

```bash
git add README.md
git commit -m "docs: add solana mobile development workflow"
```

## Risk Notes

- Mobile Wallet Adapter is Android-focused. iOS support should be treated as separate wallet strategy work.
- Device model detection is spoofable. Use it only for UI and analytics. Use backend SGT verification for trust-sensitive Seeker gating.
- SGT verification requires mainnet Helius RPC and Token-2022 parsing.
- `JWT_SECRET` must stay on the backend only. If it has been shared outside trusted deployment channels, rotate it before production use.
- Do not put `@coral-xyz/anchor@0.32.1` into the mobile app until React Native compatibility is tested. Prefer generated clients or server-built transactions for mobile.
- PrivacyCash and Light Protocol browser/WASM dependencies may need a mobile-specific storage and crypto adapter. Keep this feature behind a flag until tested on Android.
- Any trade or transfer flow must simulate first and require an explicit user action before signing/sending.

## Acceptance Criteria

- Branch `codex/solana-mobile-react-native` contains the mobile plan and implementation commits.
- `pnpm build` passes for the existing Next.js backend/web app.
- `pnpm mobile:typecheck` passes for the Expo app.
- `pnpm mobile:android` launches on Android emulator or a connected Android device.
- MWA wallet connect and sign-in work with Mock MWA Wallet.
- Seeker device detection works for UI treatment.
- SGT verification endpoint returns correct ownership status for authenticated users.
- Market browsing works against the existing API v1.
- Trade flow builds, simulates, and submits a transaction only after explicit user confirmation.

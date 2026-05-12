# Requirements Document

## Introduction

This feature covers two related goals for the Frequencii project:

1. **Solana Skills Integration** — Install and configure the relevant Solana Foundation developer skills (from [solana.com/skills](https://solana.com/skills)) into the Frequencii workspace so that AI coding agents (Kiro, Claude Code, etc.) have structured, up-to-date context about the Solana ecosystem libraries and patterns used in the project.

2. **Frequencii API Documentation** — Produce comprehensive, developer-facing documentation for the Frequencii REST API v1, derived from the live OpenAPI 3.1 spec at `https://www.frequencii.world/api/v1/openapi.json`. The documentation must cover authentication, all 15 endpoints, request/response schemas, error handling, and usage examples — without exposing secrets.

Frequencii is a privacy-first AI prediction market agent on Solana. Its API is consumed by a Flutter mobile client and is open to third-party integrations. The skills and documentation together reduce onboarding friction for contributors and integrators.

---

## Glossary

- **Skill**: A structured Markdown file (SKILL.md) placed in `.kiro/skills/` that gives an AI coding agent curated context about a library, protocol, or toolchain.
- **Solana Foundation Skills**: Official and community skills published at [github.com/solana-foundation/solana-dev-skill](https://github.com/solana-foundation/solana-dev-skill) and listed at [solana.com/skills](https://solana.com/skills).
- **API_Client**: Any consumer of the Frequencii REST API v1 (Flutter mobile app, third-party integrations, or developer tooling).
- **JWT**: JSON Web Token issued by the Frequencii API after successful wallet-signature authentication. Valid for 7 days.
- **Wallet_Signature**: An ed25519 signature produced by a Solana wallet over a timestamped message, used to prove wallet ownership without a password.
- **SSE**: Server-Sent Events — a unidirectional HTTP streaming protocol used by the `/agent/chat` endpoint.
- **Burner_Wallet**: An ephemeral Solana keypair generated per trading session, funded via the ZK shielded pool, and discarded after use.
- **OpenAPI_Spec**: The machine-readable API description at `https://www.frequencii.world/api/v1/openapi.json` (OpenAPI 3.1.0).
- **Skill_File**: A `.md` file in `.kiro/skills/` that the AI agent loads as steering context.
- **MagicBlock**: Ephemeral rollup infrastructure used for Frequencii's gasless P2P chat.
- **Light_Protocol**: ZK compression protocol used for shielded transfers and burner wallet funding.
- **Jupiter**: Solana DEX aggregator whose Prediction API provides market data and trade execution.

---

## Requirements

### Requirement 1: Install Relevant Solana Skills

**User Story:** As a developer working on Frequencii, I want the relevant Solana Foundation skills installed in the workspace, so that AI coding agents have accurate, structured context about the Solana libraries and patterns the project uses.

#### Acceptance Criteria

1. THE Skill_File for **Light Protocol** (ZK Compression) SHALL be installed at `.kiro/skills/light-protocol.md`, sourced from the Solana Foundation community skills catalog.
2. THE Skill_File for **MagicBlock** development SHALL be installed at `.kiro/skills/magicblock.md`, sourced from the Solana Foundation community skills catalog.
3. THE Skill_File for **Jupiter** (swaps, prediction markets) SHALL be installed at `.kiro/skills/jupiter.md`, sourced from the Solana Foundation community skills catalog.
4. THE Skill_File for **Helius** (RPC, DAS API, webhooks) SHALL be installed at `.kiro/skills/helius.md`, sourced from the Solana Foundation community skills catalog.
5. THE Skill_File for **Solana Frontend** (framework-kit, Wallet Standard) SHALL be installed at `.kiro/skills/solana-frontend.md`, sourced from the official Solana Foundation skills.
6. THE Skill_File for **Solana Security Checklist** SHALL be installed at `.kiro/skills/solana-security.md`, sourced from the official Solana Foundation skills.
7. THE Skill_File for **Solana Testing Strategy** SHALL be installed at `.kiro/skills/solana-testing.md`, sourced from the official Solana Foundation skills.
8. WHEN a Skill_File is installed, THE Skill_File SHALL include both the source URL and the pinned commit SHA in a header comment, and THE Skill_File SHALL NOT be considered installed if either the source URL or the commit reference is absent.
9. THE workspace SHALL contain a `.kiro/skills/README.md` that lists all installed skills, their source URLs, and the Solana ecosystem component each skill covers.

---

### Requirement 2: Frequencii API Authentication Documentation

**User Story:** As an API_Client developer, I want clear documentation of the Frequencii authentication flow, so that I can obtain a JWT and make authenticated requests without guessing the message format or signature scheme.

#### Acceptance Criteria

1. THE Documentation SHALL describe the two-step auth flow: sign a timestamped message with a Solana wallet, then POST the signature to `/api/v1/auth/login`.
2. THE Documentation SHALL specify the exact message format: `"Frequencii Auth: {unix_timestamp}"` where `{unix_timestamp}` is a Unix epoch integer.
3. THE Documentation SHALL state that THE API_Server SHALL reject login requests where the message timestamp is more than 5 minutes old.
4. THE Documentation SHALL specify that the `signature` field is a base58-encoded ed25519 signature and the `pubkey` field is a base58-encoded Solana public key.
5. THE Documentation SHALL document the `POST /api/v1/auth/refresh` endpoint, including that it requires a valid Bearer token and returns a new token with a fresh 7-day expiry.
6. THE Documentation SHALL include a working code example (TypeScript/JavaScript using `@solana/web3.js` or `tweetnacl`) demonstrating how to sign the auth message and call the login endpoint.
7. IF the login signature is invalid, THEN THE Documentation SHALL state that THE API_Server SHALL return HTTP 401 with an `error` field in the response body.
8. THE Documentation SHALL NOT include the JWT secret value or any production credentials.

---

### Requirement 3: Frequencii API Markets Endpoint Documentation

**User Story:** As an API_Client developer, I want documentation for the markets endpoints, so that I can browse and search prediction events without trial-and-error.

#### Acceptance Criteria

1. THE Documentation SHALL document `GET /api/v1/markets` including all four query parameters: `category` (enum), `search` (string), `limit` (integer, default 20), and `offset` (integer, default 0).
2. THE Documentation SHALL list the valid `category` enum values: `All`, `crypto`, `politics`, `sports`, `economics`, `mentions`, `culture`.
3. THE Documentation SHALL document the `MarketsListResponse` schema, including the `events` array, `total` integer, and `hasMore` boolean.
4. THE Documentation SHALL document `GET /api/v1/markets/{id}` including the path parameter and the `MarketDetailResponse` schema.
5. THE Documentation SHALL document the `PredictionEvent` and `PredictionMarket` nested schemas, including field names, types, and descriptions.
6. IF a market ID does not exist, THEN THE Documentation SHALL state that THE API_Server SHALL return HTTP 404 with an `error` field.
7. THE Documentation SHALL include a request/response example for listing markets filtered by category.

---

### Requirement 4: Frequencii API Trading Endpoint Documentation

**User Story:** As an API_Client developer, I want documentation for the trade and positions endpoints, so that I can build, sign, and submit prediction market trades from a burner wallet.

#### Acceptance Criteria

1. THE Documentation SHALL document `POST /api/v1/trade`, including the `TradeRequest` schema fields: `marketId`, `outcome` (enum: `YES`/`NO`), `amount` (USDC), and `walletPubkey` (the Burner_Wallet public key).
2. THE Documentation SHALL explain that THE API_Server SHALL return a base64-encoded serialized Solana transaction that the client must sign with the Burner_Wallet and submit to the network.
3. THE Documentation SHALL document `GET /api/v1/positions` including the required `walletPubkey` query parameter and the `Position` schema fields.
4. THE Documentation SHALL document `POST /api/v1/positions/{id}/claim` including the path parameter and the `walletPubkey` body field.
5. THE Documentation SHALL include a step-by-step flow showing: build trade → sign with burner wallet → submit to Solana → check position → claim payout.
6. IF required fields are missing from the trade request, THEN THE Documentation SHALL state that THE API_Server SHALL return HTTP 400 with an `error` field.

---

### Requirement 5: Frequencii API AI Agent Endpoint Documentation

**User Story:** As an API_Client developer, I want documentation for the AI agent SSE endpoint, so that I can stream real-time market analysis to mobile users without buffering the full response.

#### Acceptance Criteria

1. THE Documentation SHALL document `POST /api/v1/agent/chat` as an SSE streaming endpoint returning `Content-Type: text/event-stream`.
2. THE Documentation SHALL document the `AgentChatRequest` schema: required `message` field, optional `marketContext` (PredictionEvent), optional `trendingMarkets` array, and optional `history` array (last 10 messages, roles: `user`/`agent`).
3. THE Documentation SHALL specify the SSE chunk format: each line is `data: {"content": "...", "done": false}` and the final chunk has `"done": true`.
4. THE Documentation SHALL include a code example showing how to consume the SSE stream in a Flutter/Dart client or a JavaScript client using `EventSource` or `fetch` with streaming.
5. THE Documentation SHALL note that clients SHOULD limit the `history` array to the last 10 messages as a recommendation to bound context size, and that the API does not enforce truncation server-side.

---

### Requirement 6: Frequencii API User and Watchlist Endpoint Documentation

**User Story:** As an API_Client developer, I want documentation for the user profile and watchlist endpoints, so that I can build profile management and market-following features in the mobile app.

#### Acceptance Criteria

1. THE Documentation SHALL document `GET /api/v1/user/profile` and `PUT /api/v1/user/profile`, including the `UserProfile` and `UpdateProfileRequest` schemas.
2. THE Documentation SHALL document `POST /api/v1/user/push-token` and `DELETE /api/v1/user/push-token`, including the `PushTokenRequest` schema with `token` (FCM token string) and `platform` (enum: `android`/`ios`).
3. THE Documentation SHALL document `GET /api/v1/watchlist`, `POST /api/v1/watchlist/{eventId}`, and `DELETE /api/v1/watchlist/{eventId}`, including the `WatchlistItem` and `WatchlistResponse` schemas.
4. THE Documentation SHALL note that all user and watchlist endpoints require a valid Bearer JWT in the `Authorization` header.
5. THE Documentation SHALL include the `addedAt` timestamp field in the `WatchlistItem` schema documentation.

---

### Requirement 7: API Documentation Structure and Delivery

**User Story:** As a developer or integrator, I want the API documentation delivered as a well-structured Markdown file in the repository, so that it is version-controlled, readable on GitHub, and accessible without running the server.

#### Acceptance Criteria

1. THE Documentation SHALL be written to a single file at `docs/api/v1.md` in the Frequencii repository.
2. THE Documentation SHALL include a table of contents linking to each section.
3. THE Documentation SHALL include a quick-start section that covers obtaining a JWT, making an authenticated request, and consuming the SSE agent stream in no more than 30 lines of code, with references to the relevant full-detail sections for readers who need more context.
4. THE Documentation SHALL list both the development base URL (`http://localhost:3000`) and the production base URL (`https://www.frequencii.world`) in a dedicated "Base URLs" section.
5. THE Documentation SHALL include an error response reference table listing all documented HTTP status codes (200, 400, 401, 404) and their meanings.
6. THE Documentation SHALL NOT expose the JWT secret, private keys, or any production credentials.
7. WHEN the OpenAPI spec at `/api/v1/openapi.json` is updated, THE Documentation SHALL remain the authoritative human-readable reference and SHALL note the machine-readable spec URL for tooling consumers.

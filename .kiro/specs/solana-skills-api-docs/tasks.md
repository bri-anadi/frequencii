# Implementation Plan: Solana Skills & API Documentation

## Overview

Two-part documentation authoring task. Part 1 installs seven Solana Foundation skill files into `.kiro/skills/` (each fetched from its upstream GitHub source, pinned to a commit SHA, and prefixed with a header comment). Part 2 authors `docs/api/v1.md` — a comprehensive human-readable reference for the Frequencii REST API v1, derived from the live OpenAPI spec.

No code is compiled or deployed. All tasks produce Markdown files.

---

## Tasks

- [ ] 1. Fetch and write community skill files (parallelizable)
  - [ ] 1.1 Write `.kiro/skills/light-protocol.md`
    - Fetch raw content from `https://github.com/sendaifun/skills/tree/72ef2aa814cca4662341bfcdc01cdc288e9bb502/skills/light-protocol`
    - Prepend the required header comment block: `source`, `commit: 72ef2aa814cca4662341bfcdc01cdc288e9bb502`, `fetched: <today ISO 8601>`
    - Write to `.kiro/skills/light-protocol.md`
    - _Requirements: 1.1, 1.8_

  - [ ] 1.2 Write `.kiro/skills/magicblock.md`
    - Fetch raw content from `https://github.com/magicblock-labs/magicblock-dev-skill/tree/5546320`
    - Prepend header comment: `source`, `commit: 5546320...` (full 40-char SHA), `fetched: <today>`
    - Write to `.kiro/skills/magicblock.md`
    - _Requirements: 1.2, 1.8_

  - [ ] 1.3 Write `.kiro/skills/jupiter.md`
    - Fetch raw content from `https://github.com/jup-ag/agent-skills/tree/35f50e9/skills/integrating-jupiter`
    - Prepend header comment: `source`, `commit: 35f50e9...` (full 40-char SHA), `fetched: <today>`
    - Write to `.kiro/skills/jupiter.md`
    - _Requirements: 1.3, 1.8_

  - [ ] 1.4 Write `.kiro/skills/helius.md`
    - Fetch raw content from `https://github.com/sendaifun/skills/tree/72ef2aa814cca4662341bfcdc01cdc288e9bb502/skills/helius`
    - Prepend header comment: `source`, `commit: 72ef2aa814cca4662341bfcdc01cdc288e9bb502`, `fetched: <today>`
    - Write to `.kiro/skills/helius.md`
    - _Requirements: 1.4, 1.8_

- [ ] 2. Fetch and write official Solana Foundation skill files (parallelizable)
  - [ ] 2.1 Write `.kiro/skills/solana-frontend.md`
    - Fetch raw content from `https://github.com/solana-foundation/solana-dev-skill/blob/main/skill/references/frontend-framework-kit.md`
    - Resolve the current HEAD commit SHA of `solana-foundation/solana-dev-skill` main branch (via GitHub API or `git ls-remote`)
    - Prepend header comment with resolved SHA and today's date
    - Write to `.kiro/skills/solana-frontend.md`
    - _Requirements: 1.5, 1.8_

  - [ ] 2.2 Write `.kiro/skills/solana-security.md`
    - Fetch raw content from `https://github.com/solana-foundation/solana-dev-skill/blob/main/skill/references/security.md`
    - Use the same HEAD SHA resolved in 2.1
    - Prepend header comment with that SHA and today's date
    - Write to `.kiro/skills/solana-security.md`
    - _Requirements: 1.6, 1.8_

  - [ ] 2.3 Write `.kiro/skills/solana-testing.md`
    - Fetch raw content from `https://github.com/solana-foundation/solana-dev-skill/blob/main/skill/references/testing.md`
    - Use the same HEAD SHA resolved in 2.1
    - Prepend header comment with that SHA and today's date
    - Write to `.kiro/skills/solana-testing.md`
    - _Requirements: 1.7, 1.8_

- [ ] 3. Write `.kiro/skills/README.md`
  - Create the skills index table listing all 7 skill files, their ecosystem component, source URL, and pinned commit SHA
  - Include the "Updating Skills" instructions section as specified in the design
  - Use the actual commit SHAs recorded when writing tasks 1.1–2.3
  - _Requirements: 1.9_

- [ ] 4. Checkpoint — Verify skill files
  - Confirm all 8 files exist: `README.md` + 7 skill files
  - Confirm each skill file (excluding README) begins with `<!--` and contains both `source:` and `commit:` lines
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Fetch OpenAPI spec and author API doc scaffolding
  - [ ] 5.1 Fetch the live OpenAPI spec
    - GET `https://www.frequencii.world/api/v1/openapi.json`
    - Record all endpoint paths, request/response schemas, and enum values for use in subsequent tasks
    - _Requirements: 7.7_

  - [ ] 5.2 Write `docs/api/v1.md` — title, intro, ToC, and Base URLs sections
    - Title: "Frequencii REST API v1"
    - Intro blurb: one paragraph describing the API and its consumers
    - Table of Contents with anchor links to every section
    - Base URLs section listing `http://localhost:3000` (development) and `https://www.frequencii.world` (production)
    - Note the machine-readable spec URL: `https://www.frequencii.world/api/v1/openapi.json`
    - _Requirements: 7.1, 7.2, 7.4, 7.7_

- [ ] 6. Write Quick Start section
  - [ ] 6.1 Write the Quick Start section in `docs/api/v1.md`
    - Cover three steps in ≤30 lines of code: obtain JWT → make authenticated request → consume SSE stream
    - Use TypeScript/JavaScript for the code block
    - Use placeholder values (`YOUR_WALLET_PUBKEY`, `YOUR_JWT_TOKEN`) — no real credentials
    - Include references to the full-detail sections for each step
    - _Requirements: 7.3, 7.6_

- [ ] 7. Write Authentication section
  - [ ] 7.1 Write the Authentication section in `docs/api/v1.md`
    - Describe the two-step flow: sign timestamped message → POST to `/api/v1/auth/login`
    - Specify exact message format: `"Frequencii Auth: {unix_timestamp}"`
    - State the 5-minute timestamp expiry rule
    - Document `signature` as base58-encoded ed25519 and `pubkey` as base58-encoded Solana public key
    - Document `POST /api/v1/auth/login`: request schema (`LoginRequest`), response schema (`LoginResponse`), HTTP 401 on invalid signature
    - Document `POST /api/v1/auth/refresh`: requires valid Bearer token, returns new token with fresh 7-day expiry
    - Include TypeScript code example using `@solana/web3.js` or `tweetnacl` showing message signing and login call
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8_

- [ ] 8. Write Markets section
  - [ ] 8.1 Write the Markets section in `docs/api/v1.md`
    - Document `GET /api/v1/markets`: all four query params (`category`, `search`, `limit` default 20, `offset` default 0)
    - List valid `category` enum values: `All`, `crypto`, `politics`, `sports`, `economics`, `mentions`, `culture`
    - Document `MarketsListResponse` schema: `events` array, `total` integer, `hasMore` boolean
    - Document `GET /api/v1/markets/{id}`: path parameter and `MarketDetailResponse` schema
    - Document `PredictionEvent` and `PredictionMarket` nested schemas with all field names, types, and descriptions
    - State HTTP 404 with `error` field when market ID does not exist
    - Include a request/response example for listing markets filtered by category
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [ ] 9. Write Trading section
  - [ ] 9.1 Write the Trading section in `docs/api/v1.md`
    - Document `POST /api/v1/trade`: `TradeRequest` schema (`marketId`, `outcome` YES/NO, `amount` USDC, `walletPubkey`)
    - Explain that the response is a base64-encoded serialized Solana transaction to be signed by the burner wallet and submitted to the network
    - Document `GET /api/v1/positions`: required `walletPubkey` query param, `Position` schema with all fields
    - Document `POST /api/v1/positions/{id}/claim`: path parameter and `walletPubkey` body field
    - Include step-by-step end-to-end trade flow: build trade → sign with burner wallet → submit to Solana → check position → claim payout
    - State HTTP 400 with `error` field when required fields are missing
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6_

- [ ] 10. Write AI Agent (SSE) section
  - [ ] 10.1 Write the AI Agent section in `docs/api/v1.md`
    - Document `POST /api/v1/agent/chat` as SSE streaming endpoint with `Content-Type: text/event-stream`
    - Document `AgentChatRequest` schema: required `message`, optional `marketContext`, optional `trendingMarkets`, optional `history` (roles: `user`/`agent`)
    - Specify SSE chunk format: `data: {"content": "...", "done": false}` with final chunk having `"done": true`
    - Note the recommendation to limit `history` to last 10 messages; clarify the API does not enforce truncation server-side
    - Include client code example in TypeScript (using `fetch` with streaming) and Dart (for Flutter)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_

- [ ] 11. Write User & Watchlist section
  - [ ] 11.1 Write the User & Watchlist section in `docs/api/v1.md`
    - Document `GET /api/v1/user/profile` and `PUT /api/v1/user/profile` with `UserProfile` and `UpdateProfileRequest` schemas
    - Document `POST /api/v1/user/push-token` and `DELETE /api/v1/user/push-token` with `PushTokenRequest` schema (`token` FCM string, `platform` android/ios)
    - Document `GET /api/v1/watchlist`, `POST /api/v1/watchlist/{eventId}`, `DELETE /api/v1/watchlist/{eventId}` with `WatchlistItem` (including `addedAt`) and `WatchlistResponse` schemas
    - Note that all user and watchlist endpoints require a valid Bearer JWT in the `Authorization` header
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_

- [ ] 12. Write Schemas Reference and Error Reference sections
  - [ ] 12.1 Write the Schemas Reference section in `docs/api/v1.md`
    - Document all named schemas in a reference table format: `PredictionEvent`, `PredictionMarket`, `Position`, `UserProfile`, `WatchlistItem`
    - Include field name, type, required/optional, and description for each field
    - _Requirements: 3.5, 4.3, 6.1, 6.3_

  - [ ] 12.2 Write the Error Reference section in `docs/api/v1.md`
    - Create a table listing HTTP status codes 200, 400, 401, 404 and their meanings in the context of this API
    - Note that error responses always include an `error` string field and an optional `details` field
    - _Requirements: 7.5_

- [ ] 13. Final checkpoint — Verify API documentation
  - Confirm `docs/api/v1.md` exists and contains all required sections
  - Verify both base URLs are present, the auth message format string appears, and all 15 endpoint paths are documented
  - Verify no credential strings (`JWT_SECRET`, `private_key`, `secret_key`) appear in the file
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks 1.1–1.4 are independent and can run in parallel (community skills from different repos)
- Tasks 2.1–2.3 share the same HEAD SHA lookup; resolve the SHA once and reuse it across all three
- Tasks 7.1–12.2 each write to `docs/api/v1.md`; they must run sequentially to build the document section by section
- Task 5.1 (fetch OpenAPI spec) must complete before any API doc section tasks (6–12)
- All code examples must use placeholder values — no real credentials, JWT secrets, or private keys
- The OpenAPI spec is the authoritative schema source; cross-reference `ARCHITECTURE.md` for narrative context on auth flow and SSE protocol

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1", "1.2", "1.3", "1.4", "2.1", "5.1"] },
    { "id": 1, "tasks": ["2.2", "2.3"] },
    { "id": 2, "tasks": ["3"] },
    { "id": 3, "tasks": ["5.2"] },
    { "id": 4, "tasks": ["6.1", "7.1", "8.1"] },
    { "id": 5, "tasks": ["9.1", "10.1", "11.1"] },
    { "id": 6, "tasks": ["12.1", "12.2"] }
  ]
}
```

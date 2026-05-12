# Design Document: Solana Skills & API Documentation

## Overview

This feature produces two sets of static Markdown files:

1. **Solana Skills** — seven `.md` files in `.kiro/skills/` plus a `README.md`, each sourced from the Solana Foundation skills catalog and pinned to a specific commit SHA. These give AI coding agents (Kiro, Claude Code, etc.) structured, up-to-date context about the Solana ecosystem libraries used in Frequencii.

2. **Frequencii API Documentation** — a single comprehensive file at `docs/api/v1.md`, derived from the live OpenAPI 3.1 spec at `https://www.frequencii.world/api/v1/openapi.json`. This covers all 15 endpoints, authentication, schemas, error handling, and usage examples.

There is no code to write or deploy. The "implementation" is authoring Markdown content. The design below specifies exactly what to write, where to source it, and how to structure it.

---

## Architecture

```
.kiro/
└── skills/
    ├── README.md                  ← index of all installed skills
    ├── light-protocol.md          ← ZK Compression (sendaifun/skills @ 72ef2aa)
    ├── magicblock.md              ← Ephemeral rollups (magicblock-labs @ 5546320)
    ├── jupiter.md                 ← Prediction markets / swaps (jup-ag @ 35f50e9)
    ├── helius.md                  ← RPC / DAS API / webhooks (sendaifun/skills @ 72ef2aa)
    ├── solana-frontend.md         ← framework-kit / Wallet Standard (solana-foundation @ main)
    ├── solana-security.md         ← Security checklist (solana-foundation @ main)
    └── solana-testing.md          ← Testing strategy (solana-foundation @ main)

docs/
└── api/
    └── v1.md                      ← Frequencii REST API v1 documentation
```

The skills directory is read by Kiro at agent startup. Each skill file is loaded as steering context when the agent detects relevant task keywords. The API docs file is version-controlled alongside the codebase and readable on GitHub without running the server.

---

## Components and Interfaces

### Part 1: Skill Files

#### Sourcing Strategy

Skills are sourced from two locations in the Solana Foundation ecosystem:

| Skill | Source Repo | Pinned Commit | Category |
|---|---|---|---|
| `light-protocol.md` | `sendaifun/skills` | `72ef2aa` | INFRASTRUCTURE |
| `magicblock.md` | `magicblock-labs/magicblock-dev-skill` | `5546320` | INFRASTRUCTURE |
| `jupiter.md` | `jup-ag/agent-skills` | `35f50e9` | DEFI |
| `helius.md` | `sendaifun/skills` | `72ef2aa` | INFRASTRUCTURE |
| `solana-frontend.md` | `solana-foundation/solana-dev-skill` | `main` (latest) | FRONTEND |
| `solana-security.md` | `solana-foundation/solana-dev-skill` | `main` (latest) | SECURITY |
| `solana-testing.md` | `solana-foundation/solana-dev-skill` | `main` (latest) | TESTING |

The official Solana Foundation skills (`solana-frontend`, `solana-security`, `solana-testing`) are sourced from the `skill/references/` directory of `solana-foundation/solana-dev-skill`. The community skills are sourced from their respective repositories as listed on [solana.com/skills](https://solana.com/skills).

**Fetching process:**
1. Visit the source URL for each skill
2. Record the current commit SHA (use `git ls-remote` or the GitHub API for the pinned commit)
3. Copy the raw Markdown content
4. Prepend the header comment block (see template below)
5. Write to the target path in `.kiro/skills/`

#### Skill File Template

Every skill file MUST begin with this header comment block before any other content:

```markdown
<!--
source: <full GitHub URL to the skill file>
commit: <40-character hex commit SHA>
fetched: <ISO 8601 date, e.g. 2026-01-15>
-->
```

Example for `light-protocol.md`:

```markdown
<!--
source: https://github.com/sendaifun/skills/tree/72ef2aa814cca4662341bfcdc01cdc288e9bb502/skills/light-protocol
commit: 72ef2aa814cca4662341bfcdc01cdc288e9bb502
fetched: 2026-01-15
-->

# Light Protocol Skill
...
```

The header comment is machine-parseable (HTML comment syntax) and does not render visually in GitHub or Kiro's skill loader. A skill file is considered **not installed** if either the `source` or `commit` field is absent from this header.

#### `.kiro/skills/README.md` Structure

```markdown
# Solana Skills

AI coding agent skills installed for the Frequencii workspace.
These files provide structured context about the Solana ecosystem libraries used in this project.

## Installed Skills

| File | Ecosystem Component | Source | Commit |
|---|---|---|---|
| `light-protocol.md` | Light Protocol — ZK Compression | [sendaifun/skills](https://github.com/sendaifun/skills/tree/72ef2aa.../skills/light-protocol) | `72ef2aa` |
| `magicblock.md` | MagicBlock — Ephemeral Rollups | [magicblock-labs/magicblock-dev-skill](https://github.com/magicblock-labs/magicblock-dev-skill/tree/5546320...) | `5546320` |
| `jupiter.md` | Jupiter — Swaps & Prediction Markets | [jup-ag/agent-skills](https://github.com/jup-ag/agent-skills/tree/35f50e9.../skills/integrating-jupiter) | `35f50e9` |
| `helius.md` | Helius — RPC, DAS API, Webhooks | [sendaifun/skills](https://github.com/sendaifun/skills/tree/72ef2aa.../skills/helius) | `72ef2aa` |
| `solana-frontend.md` | Solana Frontend — framework-kit, Wallet Standard | [solana-foundation/solana-dev-skill](https://github.com/solana-foundation/solana-dev-skill/blob/main/skill/references/frontend-framework-kit.md) | (latest main) |
| `solana-security.md` | Solana Security Checklist | [solana-foundation/solana-dev-skill](https://github.com/solana-foundation/solana-dev-skill/blob/main/skill/references/security.md) | (latest main) |
| `solana-testing.md` | Solana Testing Strategy | [solana-foundation/solana-dev-skill](https://github.com/solana-foundation/solana-dev-skill/blob/main/skill/references/testing.md) | (latest main) |

## Updating Skills

To refresh a skill to a newer version:
1. Fetch the latest content from the source URL
2. Record the new commit SHA
3. Update the `<!--source/commit/fetched-->` header in the skill file
4. Update the commit column in this README
```

---

### Part 2: API Documentation (`docs/api/v1.md`)

#### Source Material

The documentation is derived from:
- **OpenAPI spec**: `https://www.frequencii.world/api/v1/openapi.json` (OpenAPI 3.1.0)
- **Live docs UI**: `https://www.frequencii.world/api/v1/docs` (Scalar)
- **Architecture doc**: `ARCHITECTURE.md` in this repository (auth flow, SSE protocol, burner wallet lifecycle)

The OpenAPI spec is the authoritative schema source. The architecture doc provides narrative context for the auth flow and SSE streaming protocol.

#### Document Structure

```
docs/api/v1.md
├── Title & intro blurb
├── Table of Contents
├── Base URLs
├── Quick Start (≤30 lines of code)
├── Authentication
│   ├── Overview (two-step flow)
│   ├── Message format
│   ├── POST /auth/login
│   ├── POST /auth/refresh
│   └── Code example (TypeScript)
├── Markets
│   ├── GET /markets
│   └── GET /markets/{id}
├── Trading
│   ├── POST /trade
│   ├── GET /positions
│   ├── POST /positions/{id}/claim
│   └── End-to-end trade flow
├── AI Agent (SSE)
│   ├── POST /agent/chat
│   ├── SSE chunk format
│   └── Client code example (TypeScript + Dart)
├── User & Watchlist
│   ├── GET/PUT /user/profile
│   ├── POST/DELETE /user/push-token
│   └── GET/POST/DELETE /watchlist/{eventId}
├── Schemas Reference
│   ├── PredictionEvent
│   ├── PredictionMarket
│   ├── Position
│   ├── UserProfile
│   └── WatchlistItem
└── Error Reference
```

---

## Data Models

### Skill File Metadata (header comment)

```
source  : string  — full GitHub URL to the upstream skill file or directory
commit  : string  — 40-character hex SHA of the pinned commit
fetched : string  — ISO 8601 date the file was last fetched
```

### API Documentation Schemas (from OpenAPI spec)

All schemas below are derived directly from `openapi.json`. They are reproduced here for design reference.

**LoginRequest**
```
pubkey    : string  — Solana wallet public key (base58)
signature : string  — Signed message (base58)
message   : string  — "Frequencii Auth: {unix_timestamp}"
```

**LoginResponse**
```
token     : string   — JWT access token (7-day expiry)
expiresAt : integer  — Token expiry (unix timestamp)
user      : UserProfile
```

**PredictionEvent**
```
id        : string
title     : string
slug      : string
description : string
category  : string
image     : uri
volume    : number   — total USD volume
active    : boolean
closed    : boolean
startDate : string
endDate   : string
volume24hr : number
markets   : PredictionMarket[]
```

**PredictionMarket**
```
id              : string
question        : string
slug            : string
outcomes        : string[]
outcomePrices   : number[]
volume          : number
endDate         : datetime
startDate       : datetime
active          : boolean
closed          : boolean
image           : uri
description     : string
category        : string
lastTradePrice  : number
oneDayPriceChange : number
```

**TradeRequest**
```
marketId    : string   — required
outcome     : "YES"|"NO"  — required
amount      : number   — USDC amount, required
walletPubkey : string  — burner wallet public key, required
```

**TradeResponse**
```
transaction : string  — base64-encoded serialized Solana transaction
```

**Position**
```
marketId    : string
marketTitle : string
outcome     : "YES"|"NO"
entryPrice  : number
currentPrice : number
amount      : number
pnl         : number
pnlPercent  : number
resolved    : boolean
claimable   : boolean
```

**AgentChatRequest**
```
message         : string           — required
marketContext   : PredictionEvent  — optional
trendingMarkets : PredictionEvent[] — optional
history         : {role: "user"|"agent", content: string}[]  — optional, last 10
```

**AgentStreamChunk**
```
content : string   — partial content chunk
done    : boolean  — true on final chunk
```

**UserProfile**
```
pubkey      : string
displayName : string
avatar      : string
createdAt   : datetime
```

**UpdateProfileRequest**
```
displayName : string  — optional
avatar      : string  — optional
```

**PushTokenRequest**
```
token    : string          — FCM push token, required
platform : "android"|"ios" — required
```

**WatchlistItem**
```
eventId : string
addedAt : datetime
```

**WatchlistResponse**
```
items : WatchlistItem[]
```

**Error**
```
error   : string  — error message, always present
details : string  — additional context, optional
```

---

## Error Handling

### Skill Files

| Failure Mode | Handling |
|---|---|
| Source URL returns 404 | Document the issue in the skill file header; do not create a placeholder file |
| Commit SHA unavailable | Use the full long SHA from the GitHub API (`/repos/{owner}/{repo}/commits/HEAD`) |
| Content encoding issues | Normalize to UTF-8 before writing |

### API Documentation

| Failure Mode | Handling |
|---|---|
| OpenAPI spec unreachable | Use the spec content fetched during design (reproduced in this document) as the source of truth |
| Schema field ambiguity | Cross-reference `ARCHITECTURE.md` and the live Scalar docs UI |
| Missing endpoint details | Note as "details pending" with the spec URL for readers |

The documentation itself must not expose error-prone content: no JWT secrets, no private keys, no production credentials. All code examples use placeholder values (e.g., `YOUR_WALLET_PUBKEY`, `YOUR_JWT_TOKEN`).

---

## Testing Strategy

This feature is documentation/content creation only. There are no functions, algorithms, or data transformations to test with property-based testing. PBT does not apply.

The appropriate verification strategy is a set of **smoke tests** (file existence) and **example-based checks** (content validation):

### Smoke Tests — File Existence

Verify that each expected file exists at the correct path:

```
.kiro/skills/README.md
.kiro/skills/light-protocol.md
.kiro/skills/magicblock.md
.kiro/skills/jupiter.md
.kiro/skills/helius.md
.kiro/skills/solana-frontend.md
.kiro/skills/solana-security.md
.kiro/skills/solana-testing.md
docs/api/v1.md
```

### Example-Based Content Checks

**Skill file header validation** — for each skill file (excluding README.md), verify:
- The file begins with an HTML comment block (`<!--`)
- The comment contains a `source:` line with a GitHub URL
- The comment contains a `commit:` line with a hex string (7–40 characters)

This can be verified with a simple grep or script:
```bash
for f in .kiro/skills/*.md; do
  [[ "$f" == *README* ]] && continue
  grep -q 'source:' "$f" || echo "MISSING source in $f"
  grep -q 'commit:' "$f" || echo "MISSING commit in $f"
done
```

**README.md content** — verify the skills README lists all 7 skill names and their source URLs.

**API docs content checks** — verify `docs/api/v1.md` contains:
- A table of contents section
- Both base URLs (`localhost:3000` and `frequencii.world`)
- The auth message format string (`Frequencii Auth:`)
- The 5-minute timestamp constraint
- All 15 endpoint paths (`/auth/login`, `/auth/refresh`, `/markets`, `/markets/{id}`, `/trade`, `/positions`, `/positions/{id}/claim`, `/agent/chat`, `/user/profile`, `/user/push-token`, `/watchlist`, `/watchlist/{eventId}`)
- An error reference table with HTTP 200, 400, 401, 404
- A quick-start code block
- No credential strings (`JWT_SECRET`, `private_key`, etc.)

**Security exclusion check** — verify `docs/api/v1.md` does not contain:
```bash
grep -iE 'jwt_secret|private.?key|secret.?key' docs/api/v1.md && echo "CREDENTIAL LEAK"
```

### Manual Review

The following require human review and cannot be automated:
- Prose clarity and accuracy of the auth flow description
- Code example correctness (TypeScript signing example, Dart SSE consumer)
- Completeness of schema field descriptions
- Accuracy of the quick-start section (≤30 lines of code, correct API calls)

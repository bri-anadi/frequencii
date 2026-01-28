# Project Context — On-chain P2P Chat & Payment Protocol (Solana)

## Project

Name: frequencii.world
Web stack: Next.js 16 + Bun runtime
UI Framework: Once UI ([https://once-ui.com/](https://once-ui.com/))

---

## Overview

frequencii.world implements a decentralized peer-to-peer chat and payment system on Solana with the following properties:

* Wallet-to-wallet messaging
* Offline message reception
* On-chain message pointers
* Encrypted off-chain message storage using IPFS
* Cryptographic ephemerality (via key lifecycle)
* Native on-chain payments (SOL, USDC, USDT)
* Anonymized receive addresses via HD address rotation
* No centralized relay server
* No custodial custody of funds or messages

The system prioritizes decentralization, offline support, and cryptographic privacy, while keeping UX similar to mainstream messaging apps.

---

## Core Design Principles

* Wallet = identity
* Blockchain = proof, routing, and settlement
* Off-chain = encrypted message storage
* No centralized relay for message delivery
* Cryptographic ephemerality instead of physical deletion
* Non-custodial architecture
* Offline-native design

---

## Tech Stack

### Frontend

* Next.js 16 (App Router)
* Bun runtime
* Once UI component library
* Solana Wallet Adapter
* WebCrypto API / libsodium for cryptography

### Blockchain

* Solana Mainnet / Devnet
* Solana Memo Program (for message pointers)
* System Program (SOL transfers)
* SPL Token Program (USDC, USDT)

### Storage

* IPFS (encrypted message blobs)
* Optional private IPFS gateway for performance

### Indexing

* Direct Solana RPC scanning
* Optional third-party indexer (e.g. Helius)

---

## High-Level Architecture

```
Next.js 16 Client (frequencii.world)
  ├─ Wallet Connect & Auth
  ├─ Encryption & Key Management
  ├─ IPFS Upload / Fetch
  ├─ Solana Transaction Sender
  ├─ Solana Chain Scanner
  ├─ TTL & Key Lifecycle Manager

Solana Blockchain
  ├─ Memo Program (message pointer)
  ├─ System Program (SOL transfers)
  ├─ SPL Token Program (USDC/USDT)

IPFS Network
  ├─ Encrypted message blobs
```

---

## Identity & Authentication

* User identity = Solana wallet public key
* No usernames or passwords
* Authentication via wallet message signature
* Wallet address is the global user identifier

---

## Chat System Design

### Message Storage Model

* Message content is NOT stored on-chain
* Encrypted message is uploaded to IPFS
* On-chain memo stores only a pointer (CID) and metadata

### Encryption

* Key exchange: X25519
* One session key per chat
* Encryption:

  * AES-256-GCM or ChaCha20-Poly1305
* Optional per-message subkeys using HKDF

---

## IPFS Payload Format

```json
{
  "version": 1,
  "ciphertext": "base64",
  "nonce": "base64",
  "created_at": 1700000000
}
```

All sensitive fields are encrypted.

---

## On-chain Message Pointer (Memo Program)

The Solana Memo Program is used as the message pointer layer.

### Memo Payload (Base64 Encoded JSON)

```json
{
  "v": 1,
  "cid": "bafy...",
  "ttl": 86400
}
```

TTL is metadata only and is not enforceable on-chain.

---

## Message Sending Flow

1. Encrypt plaintext message with session key
2. Upload encrypted payload to IPFS
3. Receive IPFS CID
4. Construct Solana transaction:

   * Optional 0-lamport transfer to recipient
   * Memo instruction containing CID and TTL
5. Sign and submit transaction
6. Blockchain stores pointer permanently

---

## Message Receiving Flow (Offline Supported)

1. Recipient comes online
2. Client scans Solana transactions involving wallet
3. Extract memo instructions
4. Parse CID and TTL
5. Fetch encrypted payload from IPFS
6. Decrypt using session key
7. Display message in UI

---

## Ephemeral Chat Model

### Supported TTL Values

* 24 hours
* 7 days
* 15 days
* 30 days

### Ephemeral Enforcement

Ephemerality is implemented via:

* Client-side message deletion
* Client-side session key wiping
* Local cache cleanup

Important:

* On-chain pointers are permanent
* IPFS data may persist
* Ephemerality is cryptographic, not storage-based

---

## Payment System

### Supported Assets

* SOL (native)
* USDC (SPL)
* USDT (SPL)

---

## Receive Address Anonymization

* Use HD receive address rotation
* Derive multiple receive addresses from wallet seed
* Rotate address per chat or per payment
* Do not reuse receive addresses

Purpose:

* Reduce linkability
* Improve receiver privacy
* Maintain offline and recoverable payments

---

## Payment Flow

1. Recipient provides rotated receive address
2. Sender creates on-chain transfer:

   * SOL via System Program
   * USDC/USDT via SPL Token Program
3. Funds are sent directly to rotated address
4. Recipient can be offline
5. Funds are recoverable via wallet seed

---

## Optional Payment Receipt in Chat

* Sender may send encrypted receipt message
* Receipt may include:

  * Amount
  * Token
  * Transaction signature

Receipt is delivered via the chat system.

---

## Offline Support

### Chat

* Message pointer stored on-chain
* Offline users can sync later
* Messages fetched from IPFS on demand

### Payments

* Payments are native on-chain
* Recipient wallet does not need to be online
* Funds available after next wallet sync

---

## Privacy Model

### Public Information

* Wallet-to-wallet interaction
* Message timestamps
* Message frequency
* Payment sender and receiver addresses
* Payment amounts

### Private Information

* Message content
* Chat content
* Payment intent
* Chat context
* Mapping of rotated receive addresses to user

---

## Privacy Guarantees

* End-to-end encrypted messages
* Cryptographic ephemerality
* Medium-strength receive address unlinkability

---

## Privacy Limitations

* Metadata graph is public
* IPFS data may persist
* No sender anonymity
* No traffic analysis resistance

---

## Indexing & Sync

Client responsibilities:

* Scan Solana for transactions involving wallet
* Extract memo instructions
* Parse CID and TTL
* Fetch IPFS content
* Decrypt and verify messages

Indexing options:

* Direct RPC scanning
* Third-party indexers (e.g. Helius)
* Client-side memo parsing

---

## Security Considerations

### Threats and Mitigations

| Threat            | Mitigation               |
| ----------------- | ------------------------ |
| IPFS persistence  | Strong encryption        |
| Chain analysis    | Address rotation         |
| Key compromise    | Session key rotation     |
| Replay attacks    | Hash verification        |
| Message tampering | Authenticated encryption |

---

## Key Management

* Session keys destroyed after TTL
* No server custody of keys
* Keys stored only in client secure storage

---

## UX Requirements

### Chat UX

* Wallet connect
* Chat list by wallet address or alias
* TTL indicator per chat
* Auto-expiry UI

### Payment UX

* Select asset (SOL, USDC, USDT)
* Auto-generate rotated receive address
* Wallet confirmation
* Transaction receipt display
* Optional encrypted receipt in chat

---

## MVP Scope

Included:

* Wallet authentication
* Memo-based message pointers
* IPFS encrypted storage
* Basic E2EE
* SOL payments
* Receive address rotation
* TTL-based message expiry
* Offline sync

Excluded (Future):

* Custom Solana message program
* ZK privacy
* Mixers or relayers
* Media attachments
* Group chat
* Full metadata privacy

---

## Known Trade-offs

* Messages are not truly deletable
* Metadata is public
* IPFS availability is variable
* No guaranteed deletion
* Sync complexity increases over time

---

## Positioning

frequencii.world provides a decentralized, wallet-native communication and payment layer on Solana, combining on-chain message pointers with encrypted off-chain storage to enable offline messaging, cryptographic ephemerality, and native crypto payments without centralized relays or custody.

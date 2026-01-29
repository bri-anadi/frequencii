# Frequencii World - Architecture

## Overview

**Frequencii World** is a privacy-focused Web3 social application built on Solana blockchain. This application combines:

- **Real-time P2P Chat** - Instant messaging with high speed and zero gas fees
- **Private Gifts** - Anonymous transfers using Zero-Knowledge Proofs

---

## System Architecture

### High-Level Architecture

```mermaid
flowchart TB
    subgraph Client["Frontend (Next.js)"]
        UI[Chat UI]
        WP[Wallet Provider]
        MB[MagicBlock Provider]
        PC[PrivacyCash Hook]
    end

    subgraph Wallets["Supported Wallets"]
        Phantom
        Solflare
    end

    subgraph Blockchain["Solana Blockchain"]
        L1[Solana L1 Mainnet/Devnet]
        Program[Frequencii Chat Program]
        ChatRoom[ChatRoom PDA]
    end

    subgraph MagicBlock["MagicBlock Ephemeral Rollups"]
        Router[MagicBlock Router]
        Rollup[Ephemeral Rollup L2]
        Delegation[Delegation Records]
    end

    subgraph Privacy["Privacy Layer"]
        LightProtocol[Light Protocol]
        ZKProof[ZK Proofs]
        ShieldedPool[Shielded Pool]
    end

    UI --> WP
    WP --> Wallets
    Wallets --> L1

    UI --> MB
    MB --> Router
    Router --> Rollup
    Rollup --> Program

    UI --> PC
    PC --> LightProtocol
    LightProtocol --> ZKProof
    ZKProof --> ShieldedPool
    ShieldedPool --> L1

    Program --> ChatRoom
    ChatRoom --> Delegation
    Delegation --> Rollup
```

---

## P2P Chat Flow

### Chat Message Flow Diagram

```mermaid
sequenceDiagram
    participant User as User
    participant Frontend as Frontend
    participant Hook as useChatRollup
    participant L1 as Solana L1
    participant MB as MagicBlock
    participant ChatRoom as ChatRoom PDA

    User->>Frontend: Send Message
    Frontend->>Hook: sendMessage(content)

    Hook->>Hook: Check if initialized

    alt Not Initialized
        Hook->>L1: initialize()
        L1->>ChatRoom: Create PDA
        ChatRoom-->>L1: Created
    end

    Hook->>Hook: Check if delegated

    alt Not Delegated
        Hook->>L1: delegate_chat()
        L1->>MB: Delegate ChatRoom
        MB-->>L1: Delegated
    end

    alt Already Delegated (Fast Path)
        Hook->>MB: send_message() via Rollup
        MB->>ChatRoom: Store Message
        Note over MB: Instant, Zero Gas
    else Not Yet Delegated (Slow Path)
        Hook->>L1: send_message() via L1
        L1->>ChatRoom: Store Message
        Note over L1: ~10-15s, Gas Fee
    end

    ChatRoom-->>Frontend: Message Stored
    Frontend-->>User: Sent
```

### Chat Listener Flow

```mermaid
flowchart LR
    subgraph Polling["Every 2 Seconds"]
        Listener[useChatListener]
    end

    subgraph Fetch["Fetch Data"]
        Router[MagicBlock Router]
        Account[ChatRoom Account]
    end

    subgraph Process["Process"]
        Decode[Decode with Anchor IDL]
        Filter[Filter by Timestamp]
        Emit[Emit New Messages]
    end

    subgraph Display["UI"]
        ChatWindow[Chat Window]
    end

    Listener -->|Poll| Router
    Router -->|Fetch| Account
    Account -->|Raw Data| Decode
    Decode -->|Messages| Filter
    Filter -->|New Only| Emit
    Emit -->|Update| ChatWindow
```

---

## Private Gift Flow

### Shielded Transfer Architecture

```mermaid
flowchart TB
    subgraph Sender["Sender"]
        S_Wallet[Public Wallet]
        S_Sign[Sign Message]
        S_Keys[Derive Encryption Keys]
    end

    subgraph Deposit["Deposit Phase"]
        PublicSOL[Public SOL]
        DepositTx[Deposit Transaction]
        ZK1[Generate ZK Proof]
    end

    subgraph ShieldedPool["Shielded Pool"]
        UTXO[Shielded UTXOs]
        Balance[Private Balance]
    end

    subgraph Transfer["Transfer Phase"]
        SelectAmount[Select Amount]
        ZK2[Generate Transfer Proof]
        Relayer[Light Protocol Relayer]
    end

    subgraph Recipient["Recipient"]
        R_UTXO[Receive Shielded UTXO]
        R_Withdraw[Withdraw to Public]
    end

    S_Wallet --> S_Sign
    S_Sign --> S_Keys
    S_Keys --> PublicSOL
    PublicSOL --> DepositTx
    DepositTx --> ZK1
    ZK1 --> UTXO
    UTXO --> Balance

    Balance --> SelectAmount
    SelectAmount --> ZK2
    ZK2 --> Relayer
    Relayer --> R_UTXO
    R_UTXO --> R_Withdraw
```

### Private Gift Sequence

```mermaid
sequenceDiagram
    participant Sender as Sender
    participant App as App
    participant Privacy as PrivacyCash
    participant Light as Light Protocol
    participant Solana as Solana

    Sender->>App: Open Gift Modal
    App->>Privacy: signIn()
    Privacy->>Sender: Request Signature
    Sender-->>Privacy: Sign Message
    Privacy->>Privacy: Derive Encryption Keys

    Sender->>App: Enter Amount

    alt Insufficient Shielded Balance
        App->>Privacy: deposit(amount)
        Privacy->>Light: Create Deposit Proof
        Light->>Solana: Compress State
        Solana-->>Privacy: UTXO Created
    end

    App->>Privacy: withdraw(amount, recipient)
    Privacy->>Light: Create Transfer Proof
    Note over Light: ZK Proof Generation
    Light->>Solana: Submit via Relayer
    Note over Solana: Sender Identity Hidden
    Solana-->>App: Gift Sent
    App-->>Sender: Success!
```

---

## User Guide

### 1. Wallet Connection

```mermaid
flowchart LR
    A[Open App] --> B[Click Connect Wallet]
    B --> C{Select Wallet}
    C --> D[Phantom]
    C --> E[Solflare]
    D --> F[Approve Connection]
    E --> F
    F --> G{Select Network}
    G --> H[Devnet - Testing]
    G --> I[Mainnet - Production]
    H --> J[Connected]
    I --> J
```

### 2. Sending Messages

| Step | Action | Description |
|------|--------|-------------|
| 1 | **Add Contact** | Click "Add Contact" - Enter Solana address |
| 2 | **Select Contact** | Choose a contact from the sidebar |
| 3 | **Type Message** | Type your message in the input field |
| 4 | **Send** | Click Send or press Enter |

> **Note**: The first message requires on-chain initialization (~10-15 seconds). After that, messages will be instant!

### 3. Sending Private Gifts

| Step | Action | Description |
|------|--------|-------------|
| 1 | **Sign In** | Click "Sign In" to generate encryption keys |
| 2 | **Check Balance** | View your shielded balance |
| 3 | **Deposit (Optional)** | Deposit SOL to the shielded pool if needed |
| 4 | **Select Recipient** | Choose the contact to receive the gift |
| 5 | **Enter Amount** | Enter the SOL amount |
| 6 | **Confirm** | Confirm the transaction |

> **Privacy**: Sender identity is hidden from the recipient!

---

## Smart Contract Architecture

### Program Structure

```mermaid
classDiagram
    class FrequenciiChat {
        +initialize()
        +send_message(content: String)
        +delegate_chat()
        +undelegate_chat()
    }

    class ChatRoom {
        +message_count: u64
        +messages: Vec~ChatMessage~
    }

    class ChatMessage {
        +sender: Pubkey
        +content: String
        +timestamp: i64
    }

    class MessageSent {
        <<event>>
        +sender: Pubkey
        +content: String
        +timestamp: i64
    }

    FrequenciiChat --> ChatRoom : manages
    ChatRoom --> ChatMessage : contains
    FrequenciiChat ..> MessageSent : emits
```

### PDA Derivation

```mermaid
flowchart LR
    subgraph Seeds["Seeds"]
        S1["chat_v2"]
        S2["user_pubkey"]
    end

    subgraph Derivation["PDA Derivation"]
        Hash[SHA256 Hash]
        Bump[Find Bump]
    end

    subgraph Result["Result"]
        PDA[ChatRoom PDA]
    end

    S1 --> Hash
    S2 --> Hash
    Hash --> Bump
    Bump --> PDA
```

---

## Development

### Quick Start

```bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start
```

### Environment Variables

```env
# Required
NEXT_PUBLIC_REOWN_PROJECT_ID=your_project_id

# Optional - Custom RPC
NEXT_PUBLIC_HELIUS_RPC_URL=https://your-helius-rpc.com
```

### Project Structure

```
frequencii/
├── src/
│   ├── app/(main)/
│   │   └── chat/
│   │       ├── page.tsx              # Main chat UI
│   │       ├── components/           # Chat components
│   │       └── hooks/
│   │           ├── useChatRollup.ts  # MagicBlock integration
│   │           ├── usePrivacyCash.ts # Privacy layer
│   │           └── useChatListener.ts # Message polling
│   ├── components/
│   │   ├── WalletProvider.tsx        # Wallet setup
│   │   └── MagicBlockProvider.tsx    # Rollup provider
│   └── utils/
│       └── frequencii_chat.json      # Anchor IDL
├── contracts/
│   └── frequencii_chat/
│       └── programs/
│           └── frequencii_chat/
│               └── src/lib.rs        # Smart contract
└── HOW_TO_USE.md                     # This file
```

---

## Technical Specifications

### Performance

| Metric | Via MagicBlock | Via Solana L1 |
|--------|---------------|---------------|
| **Latency** | < 1 second | 10-15 seconds |
| **Gas Cost** | FREE | ~5000-10000 lamports |
| **Throughput** | 1000+ msg/sec | ~400 TPS |

### Privacy Features

| Feature | Technology | Guarantee |
|---------|------------|-----------|
| **Sender Anonymity** | Light Protocol ZK | Identity hidden |
| **Transaction Unlinkability** | UTXO Model | No chain analysis |
| **Amount Privacy** | Encrypted | Hidden from public |

### Limitations

| Limitation | Description |
|------------|-------------|
| **Message Storage** | Max 20 messages per chat room |
| **Message Size** | Max 256 bytes per message |
| **Minimum Gift** | 0.01 SOL |
| **Gift Fee** | ~0.5-1% + ~0.007 SOL withdrawal |

---

## Security Considerations

```mermaid
flowchart TB
    subgraph Threats["Threats"]
        T1[Key Compromise]
        T2[Replay Attack]
        T3[Message Tampering]
        T4[Chain Analysis]
    end

    subgraph Mitigations["Mitigations"]
        M1[Session Key Rotation]
        M2[Timestamp Verification]
        M3[AES-256-GCM Encryption]
        M4[Address Rotation]
    end

    T1 --> M1
    T2 --> M2
    T3 --> M3
    T4 --> M4
```

---

## Additional Resources

- **Solana Docs**: https://solana.com/docs
- **MagicBlock**: https://magicblock.gg
- **Light Protocol**: https://lightprotocol.com
- **Anchor Framework**: https://anchor-lang.com

---

## License

This project is built for the Solana ecosystem competition.

---

*Built on Solana*

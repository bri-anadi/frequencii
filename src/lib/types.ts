// ============================================
// Prediction Market Types (Jupiter-native)
// ============================================

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
  image?: string;
  description: string;
  category?: string;
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
  volume24hr: number;
}

export type MarketCategory =
  | "All"
  | "crypto"
  | "politics"
  | "sports"
  | "economics"
  | "mentions"
  | "culture";

export interface MarketFilter {
  category: MarketCategory;
  search: string;
  sort: "volume" | "newest" | "ending_soon";
  limit: number;
  offset: number;
}

// ============================================
// AI Agent Types
// ============================================

export interface AgentMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
}

export interface AgentRequest {
  message: string;
  marketContext?: PredictionEvent | null;
  history?: AgentMessage[];
}

export interface AgentResponse {
  content: string;
  done: boolean;
}

// ============================================
// Burner Wallet Types
// ============================================

export interface BurnerWalletState {
  publicKey: string;
  encryptedPrivateKey: string;
  balance: number; // in lamports
  isSetup: boolean;
}

export type BurnerSetupStep =
  | "idle"
  | "generating"
  | "signing"
  | "encrypting"
  | "stored"
  | "depositing"
  | "withdrawing"
  | "complete";

export interface BurnerFundingState {
  step: BurnerSetupStep;
  message: string;
  error?: string;
}

// ============================================
// Trade Types
// ============================================

export type TradeOutcome = "YES" | "NO";

export interface TradeRequest {
  marketId: string;
  outcome: TradeOutcome;
  amount: number; // in USDC or SOL
  walletPubkey: string; // burner wallet pubkey
}

export type TradeStep =
  | "idle"
  | "building"
  | "signing"
  | "submitting"
  | "confirming"
  | "complete"
  | "failed";

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

// ============================================
// API Response Wrappers
// ============================================

export interface MarketsApiResponse {
  events: PredictionEvent[];
  total: number;
  hasMore: boolean;
}

export interface MarketDetailApiResponse {
  event: PredictionEvent;
}

// ============================================
// Unified Chat Message Type
// ============================================

export interface UnifiedMessage {
  id: string;
  sender: "me" | "frequant" | string; // string = wallet address
  content: string;
  timestamp: string;
  type: "user" | "agent" | "gift" | "system";
  isStreaming?: boolean;
  txHash?: string;
  amount?: string;
  token?: string;
}

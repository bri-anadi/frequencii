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
  id?: string;
  positionId?: string;
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

export interface AgentMessage {
  id: string;
  role: "user" | "agent" | "system";
  content: string;
  timestamp: string;
  isStreaming?: boolean;
  relatedMarketIds?: string[];
}

export interface UserProfile {
  pubkey: string;
  displayName: string;
  avatar: string;
  createdAt: string;
}

import type { AgentMessage, Position, PredictionEvent, UserProfile } from "./types";

export interface MarketsResponse {
  events: PredictionEvent[];
  total: number;
  hasMore: boolean;
}

export interface LoginResponse {
  token: string;
  expiresAt: number;
  user: {
    pubkey: string;
    displayName: string;
    avatar: string;
    createdAt: string;
  };
}

export interface PositionsResponse {
  positions: Position[];
}

export interface MarketDetailResponse {
  event: PredictionEvent;
}

export interface TradeRequest {
  marketId: string;
  outcome: "YES" | "NO";
  amount: number;
  walletPubkey: string;
}

export interface TradeResponse {
  transaction?: string;
  serializedTransaction?: string;
  tx?: string;
  [key: string]: unknown;
}

export interface ClaimRequest {
  walletPubkey: string;
}

export interface WatchlistItem {
  eventId: string;
  addedAt: string;
}

export interface WatchlistResponse {
  items: WatchlistItem[];
}

export interface WatchlistMutationResponse {
  added?: boolean;
  removed?: boolean;
}

export interface SeekerVerificationResponse {
  hasGenesisToken: boolean;
  genesisTokenMint: string | null;
}

export interface AgentChatRequest {
  message: string;
  marketContext?: PredictionEvent | null;
  trendingMarkets?: PredictionEvent[];
  history?: Pick<AgentMessage, "role" | "content">[];
}

export interface ProfileUpdateResponse {
  updated: boolean;
  user: UserProfile;
}

export interface AuthRefreshResponse {
  token: string;
  expiresAt: number;
}

export interface PushTokenMutationResponse {
  registered?: boolean;
  removed?: boolean;
}

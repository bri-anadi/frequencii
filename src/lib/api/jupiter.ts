/**
 * Shared Jupiter Prediction API logic.
 * Extracted from /api/jupiter/route.ts for reuse across v1 endpoints.
 */

import type { PredictionEvent, PredictionMarket } from "@/lib/types";

const JUPITER_API_BASE = "https://api.jup.ag/prediction/v1";
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || "";

// ============================================
// Cache
// ============================================

const cache = new Map<string, { data: any; expiresAt: number }>();
const CACHE_TTL_MS = 60_000; // 60 seconds

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    return entry.data as T;
  }
  cache.delete(key);
  return null;
}

function setCache(key: string, data: any) {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

// ============================================
// Headers
// ============================================

function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }
  return headers;
}

// ============================================
// Parsers
// ============================================

export function parseJupiterMarket(raw: any): PredictionMarket {
  let outcomes: string[] = ["Yes", "No"];
  let outcomePrices: number[] = [0.5, 0.5];

  if (Array.isArray(raw.outcomes)) {
    outcomes = raw.outcomes;
  }
  if (Array.isArray(raw.outcomePrices)) {
    outcomePrices = raw.outcomePrices.map(Number);
  }

  const pricing = raw.pricing || {};
  const buyYes = (pricing.buyYesPriceUsd || 0) / 1_000_000;
  const marketVolume = (pricing.volume || 0) / 1_000_000;

  return {
    id: raw.marketId || "",
    question: raw.title || "",
    slug: raw.marketId || "",
    outcomes,
    outcomePrices,
    volume: marketVolume,
    endDate: raw.closeTime
      ? new Date(raw.closeTime * 1000).toISOString()
      : "",
    startDate: raw.openTime
      ? new Date(raw.openTime * 1000).toISOString()
      : "",
    active: raw.status === "open",
    closed: raw.status === "closed",
    image: raw.imageUrl || "",
    description: raw.rulesPrimary || "",
    category: "",
    lastTradePrice: buyYes || outcomePrices[0] || 0,
    oneDayPriceChange: 0,
  };
}

export function parseJupiterEvent(raw: any): PredictionEvent {
  const metadata = raw.metadata || {};
  let markets: PredictionMarket[] = Array.isArray(raw.markets)
    ? raw.markets.map(parseJupiterMarket)
    : [];

  if (markets.length === 0) {
    markets = [{
      id: raw.eventId || "",
      question: metadata.title || "",
      slug: metadata.slug || raw.eventId || "",
      outcomes: ["Yes", "No"],
      outcomePrices: [0.5, 0.5],
      volume: Number(raw.volumeUsd || 0) / 1_000_000,
      endDate: metadata.closeTime || "",
      startDate: raw.beginAt ? new Date(Number(raw.beginAt) * 1000).toISOString() : "",
      active: raw.isActive ?? true,
      closed: raw.resolution === "resolved",
      image: metadata.imageUrl || "",
      description: raw.closeCondition || "",
      category: raw.category || "",
      lastTradePrice: 0.5,
      oneDayPriceChange: 0,
    }];
  }

  const volumeUsd = Number(raw.volumeUsd || 0) / 1_000_000;
  const volume24hr = Number(raw.volume24hr || 0) / 1_000_000;

  return {
    id: raw.eventId || "",
    title: metadata.title || "",
    slug: metadata.slug || raw.eventId || "",
    description: raw.markets?.[0]?.rulesPrimary || metadata.description || raw.closeCondition || "",
    category: raw.category || "Other",
    image: metadata.imageUrl || "",
    volume: volumeUsd,
    active: raw.isActive ?? true,
    closed: !(raw.isActive ?? true),
    startDate: raw.beginAt || "",
    endDate: metadata.closeTime || "",
    markets,
    volume24hr,
  };
}

function mapCategory(category: string): string | null {
  if (category === "All" || !category) return null;
  return category.toLowerCase();
}

// ============================================
// Shared API functions
// ============================================

export interface FetchEventsOptions {
  category?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface FetchEventsResult {
  events: PredictionEvent[];
  total: number;
  hasMore: boolean;
}

/**
 * Fetch prediction events from Jupiter API.
 */
export async function fetchEvents(
  opts: FetchEventsOptions = {}
): Promise<FetchEventsResult> {
  const { category = "All", search = "", limit = 20, offset = 0 } = opts;
  const headers = buildHeaders();

  // Search mode
  if (search) {
    const cacheKey = `search_${search}_${limit}_${offset}`;
    const cached = getCached<FetchEventsResult>(cacheKey);
    if (cached) return cached;

    const url = `${JUPITER_API_BASE}/events/search?query=${encodeURIComponent(search)}&limit=${limit}&start=${offset}`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Jupiter search error: ${res.status} — ${errText}`);
    }

    const raw = await res.json();
    const rawEvents = Array.isArray(raw) ? raw : (raw.data || raw.events || []);
    const events = rawEvents.map(parseJupiterEvent);

    const result: FetchEventsResult = {
      events,
      total: events.length,
      hasMore: raw?.pagination?.hasNext ?? (rawEvents.length >= limit),
    };

    setCache(cacheKey, result);
    return result;
  }

  // Regular listing
  const cat = mapCategory(category);
  const cacheKey = `markets_${category}_${limit}_${offset}`;
  const cached = getCached<FetchEventsResult>(cacheKey);
  if (cached) return cached;

  let url = `${JUPITER_API_BASE}/events?limit=${limit}&start=${offset}`;
  if (cat) url += `&category=${cat}`;

  const res = await fetch(url, { headers });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Jupiter API error: ${res.status} — ${errText}`);
  }

  const raw = await res.json();
  const rawEvents = Array.isArray(raw) ? raw : (raw.data || raw.events || []);
  const events = rawEvents.map(parseJupiterEvent);

  const filtered = events.filter(
    (e: PredictionEvent) => e.markets.length > 0 && e.active && e.volume > 0
  );
  filtered.sort((a: PredictionEvent, b: PredictionEvent) => b.volume - a.volume);

  const result: FetchEventsResult = {
    events: filtered,
    total: filtered.length,
    hasMore: raw?.pagination?.hasNext ?? (rawEvents.length >= limit),
  };

  setCache(cacheKey, result);
  return result;
}

/**
 * Fetch a single event by ID from Jupiter API.
 */
export async function fetchEventById(eventId: string): Promise<PredictionEvent | null> {
  const headers = buildHeaders();
  const cacheKey = `event_${eventId}`;
  const cached = getCached<PredictionEvent>(cacheKey);
  if (cached) return cached;

  const url = `${JUPITER_API_BASE}/events/${eventId}`;
  const res = await fetch(url, { headers });

  if (!res.ok) {
    if (res.status === 404) return null;
    const errText = await res.text();
    throw new Error(`Jupiter event error: ${res.status} — ${errText}`);
  }

  const raw = await res.json();
  const event = parseJupiterEvent(raw);
  setCache(cacheKey, event);
  return event;
}

/**
 * Build a trade transaction via Jupiter API.
 */
export async function buildTrade(
  marketId: string,
  outcome: string,
  amount: number,
  walletPubkey: string
): Promise<any> {
  const headers = buildHeaders();

  // Jupiter API expects isBuy: true for YES, false for NO
  const isBuy = outcome.toUpperCase() === "YES";

  const res = await fetch(`${JUPITER_API_BASE}/orders`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      marketId,
      isBuy,
      amount,
      userPubkey: walletPubkey,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Jupiter trade error: ${res.status} — ${errText}`);
  }

  return res.json();
}

/**
 * Fetch user positions from Jupiter API.
 */
export async function fetchPositions(walletPubkey: string): Promise<any> {
  const headers = buildHeaders();

  const res = await fetch(
    `${JUPITER_API_BASE}/positions?userPubkey=${walletPubkey}`,
    { headers }
  );

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Jupiter positions error: ${res.status} — ${errText}`);
  }

  return res.json();
}

/**
 * Claim a payout for a resolved position.
 */
export async function claimPayout(
  positionId: string,
  walletPubkey: string
): Promise<any> {
  const headers = buildHeaders();

  const res = await fetch(`${JUPITER_API_BASE}/claim`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      positionId,
      userPubkey: walletPubkey,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Jupiter claim error: ${res.status} — ${errText}`);
  }

  return res.json();
}

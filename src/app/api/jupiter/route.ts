import { NextRequest, NextResponse } from "next/server";
import type { PredictionEvent, PredictionMarket } from "@/lib/types";

const JUPITER_API_BASE = "https://api.jup.ag/prediction/v1";
const JUPITER_API_KEY = process.env.JUPITER_API_KEY || "";

// Simple in-memory cache
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

/**
 * Build headers for Jupiter API requests.
 */
function buildHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (JUPITER_API_KEY) {
    headers["x-api-key"] = JUPITER_API_KEY;
  }
  return headers;
}

/**
 * Transform a raw Jupiter market into our PredictionMarket shape.
 */
function parseJupiterMarket(raw: any): PredictionMarket {
  let outcomes: string[] = ["Yes", "No"];
  let outcomePrices: number[] = [0.5, 0.5];

  if (Array.isArray(raw.outcomes)) {
    outcomes = raw.outcomes;
  }
  if (Array.isArray(raw.outcomePrices)) {
    outcomePrices = raw.outcomePrices.map(Number);
  }

  // Pricing from Jupiter's pricing object
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

/**
 * Transform a raw Jupiter event into our PredictionEvent shape.
 */
function parseJupiterEvent(raw: any): PredictionEvent {
  const metadata = raw.metadata || {};
  const markets: PredictionMarket[] = Array.isArray(raw.markets)
    ? raw.markets.map(parseJupiterMarket)
    : [];

  const volumeUsd = Number(raw.volumeUsd || 0) / 1_000_000;
  const volume24hr = Number(raw.volume24hr || 0) / 1_000_000;

  return {
    id: raw.eventId || "",
    title: metadata.title || "",
    slug: metadata.slug || raw.eventId || "",
    description: raw.closeCondition || "",
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

/**
 * Map our MarketCategory to Jupiter's category param.
 */
function mapCategory(category: string): string | null {
  // Jupiter categories are lowercase: crypto, politics, sports, economics, mentions
  if (category === "All" || !category) return null;
  return category.toLowerCase();
}

/**
 * Server-side proxy for Jupiter Prediction API.
 * Attaches API key server-side and routes requests.
 *
 * POST /api/jupiter
 * Body: { action: "markets" | "search" | "trade" | "positions" | "claim", ... }
 */
export async function POST(request: NextRequest) {
  try {
    let body;
    try {
      body = await request.json();
    } catch (e) {
      return NextResponse.json(
        { error: "Invalid JSON body provided" },
        { status: 400 }
      );
    }
    const { action } = body;

    if (!action) {
      return NextResponse.json(
        { error: "action is required (markets | search | trade | positions | claim)" },
        { status: 400 }
      );
    }

    const headers = buildHeaders();

    switch (action) {
      case "markets": {
        const {
          category = "All",
          search = "",
          limit = 20,
          offset = 0,
        } = body;

        // If a search query is provided, use the search endpoint
        if (search) {
          const cacheKey = `search_${search}_${limit}_${offset}`;
          const cached = getCached<any>(cacheKey);
          if (cached) return NextResponse.json(cached);

          const searchUrl = `${JUPITER_API_BASE}/events/search?query=${encodeURIComponent(search)}&limit=${limit}&offset=${offset}`;
          const res = await fetch(searchUrl, { headers });

          if (!res.ok) {
            const errText = await res.text();
            return NextResponse.json(
              { error: "Jupiter search error", details: errText },
              { status: res.status }
            );
          }

          const raw = await res.json();
          const rawEvents = Array.isArray(raw)
            ? raw
            : (raw.data || raw.events || []);
          const events: PredictionEvent[] = rawEvents.map(parseJupiterEvent);

          const filtered = events.filter(
            (e) => e.markets.length > 0 && e.active && e.volume > 0
          );

          const response = {
            events: filtered,
            total: filtered.length,
            hasMore: rawEvents.length >= limit,
          };

          setCache(cacheKey, response);
          return NextResponse.json(response);
        }

        // Regular listing
        const cat = mapCategory(category);
        const cacheKey = `markets_${category}_${limit}_${offset}`;
        const cached = getCached<any>(cacheKey);
        if (cached) return NextResponse.json(cached);

        let url = `${JUPITER_API_BASE}/events?limit=${limit}&offset=${offset}`;
        if (cat) {
          url += `&category=${cat}`;
        }

        const res = await fetch(url, { headers });

        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json(
            { error: "Jupiter API error", details: errText },
            { status: res.status }
          );
        }

        const raw = await res.json();
        const rawEvents = Array.isArray(raw)
          ? raw
          : (raw.data || raw.events || []);
        const events: PredictionEvent[] = rawEvents.map(parseJupiterEvent);

        // Filter out events with no active markets or zero volume
        const filtered = events.filter(
          (e) => e.markets.length > 0 && e.active && e.volume > 0
        );

        // Sort by volume descending (default)
        filtered.sort((a, b) => b.volume - a.volume);

        const hasMoreFromApi = raw?.pagination?.hasMore ?? (rawEvents.length >= limit);

        const response = {
          events: filtered,
          total: filtered.length,
          hasMore: hasMoreFromApi,
        };

        setCache(cacheKey, response);
        return NextResponse.json(response);
      }

      case "trade": {
        const { marketId, outcome, amount, walletPubkey } = body;

        if (!marketId || !outcome || !amount || !walletPubkey) {
          return NextResponse.json(
            {
              error:
                "Required fields: marketId, outcome, amount, walletPubkey",
            },
            { status: 400 }
          );
        }

        const res = await fetch(`${JUPITER_API_BASE}/orders`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            marketId,
            outcome,
            amount,
            userPubkey: walletPubkey,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json(
            { error: "Jupiter trade error", details: errText },
            { status: res.status }
          );
        }

        const data = await res.json();
        return NextResponse.json(data);
      }

      case "positions": {
        const { walletPubkey } = body;

        if (!walletPubkey) {
          return NextResponse.json(
            { error: "walletPubkey is required" },
            { status: 400 }
          );
        }

        const res = await fetch(
          `${JUPITER_API_BASE}/positions?userPubkey=${walletPubkey}`,
          { headers }
        );

        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json(
            { error: "Jupiter positions error", details: errText },
            { status: res.status }
          );
        }

        const data = await res.json();
        return NextResponse.json(data);
      }

      case "claim": {
        const { positionId, walletPubkey: claimWallet } = body;

        if (!positionId || !claimWallet) {
          return NextResponse.json(
            { error: "Required fields: positionId, walletPubkey" },
            { status: 400 }
          );
        }

        const res = await fetch(`${JUPITER_API_BASE}/claim`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            positionId,
            userPubkey: claimWallet,
          }),
        });

        if (!res.ok) {
          const errText = await res.text();
          return NextResponse.json(
            { error: "Jupiter claim error", details: errText },
            { status: res.status }
          );
        }

        const data = await res.json();
        return NextResponse.json(data);
      }

      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }
  } catch (error: any) {
    console.error("Jupiter API proxy error:", error);
    return NextResponse.json(
      { error: "Internal server error", details: error.message },
      { status: 500 }
    );
  }
}

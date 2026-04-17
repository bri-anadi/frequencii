import { useState, useEffect, useCallback, useRef } from "react";
import type {
  PredictionEvent,
  MarketFilter,
  MarketCategory,
  MarketsApiResponse,
} from "../types";

const DEFAULT_FILTER: MarketFilter = {
  category: "All",
  search: "",
  sort: "volume",
  limit: 20,
  offset: 0,
};

const REFRESH_INTERVAL_MS = 60_000; // Auto-refresh every 60s

export function useMarkets() {
  const [markets, setMarkets] = useState<PredictionEvent[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<PredictionEvent | null>(
    null
  );
  const [filters, setFilters] = useState<MarketFilter>(DEFAULT_FILTER);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchMarkets = useCallback(
    async (currentFilters: MarketFilter, append = false) => {
      setIsLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/jupiter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "markets",
            category: currentFilters.category,
            search: currentFilters.search,
            limit: currentFilters.limit,
            offset: currentFilters.offset,
          }),
        });

        if (!res.ok) {
          throw new Error(`Failed to fetch markets: ${res.status}`);
        }

        const data: MarketsApiResponse = await res.json();

        if (append) {
          setMarkets((prev) => [...prev, ...data.events]);
        } else {
          setMarkets(data.events);
        }
        setHasMore(data.hasMore);
      } catch (err: any) {
        console.error("useMarkets fetch error:", err);
        setError(err.message || "Failed to load markets");
      } finally {
        setIsLoading(false);
      }
    },
    []
  );

  // Initial fetch + auto-refresh
  useEffect(() => {
    fetchMarkets(filters);

    intervalRef.current = setInterval(() => {
      fetchMarkets(filters);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [filters, fetchMarkets]);

  const refetch = useCallback(() => {
    fetchMarkets(filters);
  }, [filters, fetchMarkets]);

  const loadMore = useCallback(() => {
    const nextFilters = { ...filters, offset: filters.offset + filters.limit };
    setFilters(nextFilters);
    fetchMarkets(nextFilters, true);
  }, [filters, fetchMarkets]);

  const updateCategory = useCallback((category: MarketCategory) => {
    setFilters((prev) => ({ ...prev, category, offset: 0 }));
  }, []);

  const updateSearch = useCallback((search: string) => {
    setFilters((prev) => ({ ...prev, search, offset: 0 }));
  }, []);

  const updateSort = useCallback(
    (sort: MarketFilter["sort"]) => {
      setFilters((prev) => ({ ...prev, sort, offset: 0 }));
    },
    []
  );

  const selectMarket = useCallback((market: PredictionEvent | null) => {
    setSelectedMarket(market);
  }, []);

  return {
    markets,
    selectedMarket,
    filters,
    isLoading,
    error,
    hasMore,
    refetch,
    loadMore,
    selectMarket,
    updateCategory,
    updateSearch,
    updateSort,
  };
}

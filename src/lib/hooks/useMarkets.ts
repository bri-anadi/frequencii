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
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // Initial fetch on mount
  useEffect(() => {
    fetchMarkets({ category: "All", search: "", sort: "volume", offset: 0, limit: 20 });
    // Note: NOT depending on `filters` to avoid resetting list when offset changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Set up auto-refresh using an interval that references the current filters
  const filtersRef = useRef(filters);
  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      // Background refresh uses the same offset but starts from 0 to current?
      // Actually, a simple background refresh should just update current items or fetch offset: 0.
      // For now, let's keep it simple and just fetch with the current filters.
      fetchMarkets(filtersRef.current);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [fetchMarkets]);

  const refetch = useCallback(() => {
    fetchMarkets(filters);
  }, [filters, fetchMarkets]);

  const loadMore = useCallback(() => {
    const nextFilters = { ...filters, offset: filters.offset + filters.limit };
    setFilters(nextFilters);
    fetchMarkets(nextFilters, true);
  }, [filters, fetchMarkets]);

  const updateCategory = useCallback(
    (category: MarketCategory) => {
      const nextFilters = { ...filters, category, offset: 0 };
      setFilters(nextFilters);
      fetchMarkets(nextFilters);
    },
    [filters, fetchMarkets]
  );

  const updateSearch = useCallback(
    (search: string) => {
      const nextFilters = { ...filters, search, offset: 0 };
      setFilters(nextFilters);
      fetchMarkets(nextFilters);
    },
    [filters, fetchMarkets]
  );

  const updateSort = useCallback(
    (sort: MarketFilter["sort"]) => {
      const nextFilters = { ...filters, sort, offset: 0 };
      setFilters(nextFilters);
      fetchMarkets(nextFilters);
    },
    [filters, fetchMarkets]
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

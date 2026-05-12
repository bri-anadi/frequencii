import type {
  MarketDetailResponse,
  MarketsResponse,
  PredictionEvent,
  TradeOutcome,
  WatchlistResponse,
} from "@frequencii/shared";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiRequest } from "../../api/client";
import { BottomSheet } from "../../components/BottomSheet";
import { SkeletonList } from "../../components/SkeletonRow";
import { hapticLight, hapticMedium } from "../../utils/haptics";
import { useMobileJupiterPredict } from "../trade/useMobileJupiterPredict";

interface MarketsScreenProps {
  token: string;
  walletAddress: string;
}

const categories = ["All", "crypto", "politics", "sports", "economics", "culture", "mentions"];
type SortOption = "volume" | "newest" | "ending_soon";
const sortOptions: { key: SortOption; label: string }[] = [
  { key: "volume", label: "Volume" },
  { key: "newest", label: "Newest" },
  { key: "ending_soon", label: "Ending Soon" },
];

const PAGE_SIZE = 30;
const DEBOUNCE_MS = 400;

export function MarketsScreen({ token, walletAddress }: MarketsScreenProps) {
  const [events, setEvents] = useState<PredictionEvent[]>([]);
  const [watchlistIds, setWatchlistIds] = useState<Set<string>>(new Set());
  const [selectedEvent, setSelectedEvent] = useState<PredictionEvent | null>(null);
  const [category, setCategory] = useState("All");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortOption>("volume");
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadWatchlist = useCallback(async () => {
    try {
      const response = await apiRequest<WatchlistResponse>("/api/v1/watchlist", { token });
      setWatchlistIds(new Set(response.items.map((item) => item.eventId)));
    } catch {
      // Non-critical — keep existing watchlist state
    }
  }, [token]);

  const loadMarkets = useCallback(
    async (options: { refresh?: boolean; append?: boolean } = {}) => {
      const { refresh = false, append = false } = options;

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const offset = append ? offsetRef.current : 0;

      if (refresh) setIsRefreshing(true);
      else if (append) setIsLoadingMore(true);
      else setIsLoading(true);

      setError(null);

      try {
        const query = new URLSearchParams({
          category,
          search,
          sort,
          limit: String(PAGE_SIZE),
          offset: String(offset),
        });
        const response = await apiRequest<MarketsResponse>(
          `/api/v1/markets?${query.toString()}`,
          { token, signal: controller.signal },
        );

        if (controller.signal.aborted) return;

        if (append) {
          setEvents((current) => [...current, ...response.events]);
        } else {
          setEvents(response.events);
        }

        offsetRef.current = offset + response.events.length;
        setHasMore(response.hasMore ?? response.events.length >= PAGE_SIZE);

        if (!append) await loadWatchlist();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : "Failed to load markets");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
        setIsLoadingMore(false);
      }
    },
    [category, loadWatchlist, search, sort, token],
  );

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      loadMarkets();
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [search, category, sort, loadMarkets]);

  const loadMore = useCallback(() => {
    if (!isLoadingMore && hasMore && !isLoading) {
      loadMarkets({ append: true });
    }
  }, [hasMore, isLoading, isLoadingMore, loadMarkets]);

  const openEvent = useCallback(
    async (event: PredictionEvent) => {
      setSelectedEvent(event);
      try {
        const response = await apiRequest<MarketDetailResponse>(
          `/api/v1/markets/${encodeURIComponent(event.id)}`,
          { token },
        );
        setSelectedEvent(response.event);
      } catch {
        // Keep the basic event data
      }
    },
    [token],
  );

  const toggleWatchlist = useCallback(
    async (eventId: string) => {
      hapticLight();
      const isWatched = watchlistIds.has(eventId);
      setWatchlistIds((current) => {
        const next = new Set(current);
        if (isWatched) next.delete(eventId);
        else next.add(eventId);
        return next;
      });

      try {
        await apiRequest(`/api/v1/watchlist/${encodeURIComponent(eventId)}`, {
          method: isWatched ? "DELETE" : "POST",
          token,
        });
      } catch (err) {
        setWatchlistIds((current) => {
          const next = new Set(current);
          if (isWatched) next.add(eventId);
          else next.delete(eventId);
          return next;
        });
        Alert.alert("Watchlist update failed", err instanceof Error ? err.message : "Try again.");
      }
    },
    [token, watchlistIds],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <View style={styles.searchRow}>
        <TextInput
          autoCapitalize="none"
          onChangeText={setSearch}
          placeholder="Search markets"
          placeholderTextColor="#6f776a"
          returnKeyType="search"
          style={styles.searchInput}
          value={search}
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoryScroller}
      >
        {categories.map((item) => {
          const active = item === category;
          return (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[styles.categoryPill, active && styles.categoryPillActive]}
            >
              <Text style={[styles.categoryText, active && styles.categoryTextActive]}>
                {item}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.sortRow}>
        {sortOptions.map((option) => (
          <Pressable
            key={option.key}
            onPress={() => setSort(option.key)}
            style={[styles.sortPill, sort === option.key && styles.sortPillActive]}
          >
            <Text style={[styles.sortText, sort === option.key && styles.sortTextActive]}>
              {option.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {isLoading && events.length === 0 ? (
        <SkeletonList count={6} />
      ) : error ? (
        <View style={styles.centerState}>
          <Text style={styles.errorText}>{error}</Text>
          <Pressable onPress={() => loadMarkets()} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          onEndReached={loadMore}
          onEndReachedThreshold={0.2}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              tintColor="#d4ff62"
              onRefresh={() => loadMarkets({ refresh: true })}
            />
          }
          renderItem={({ item }) => (
            <MarketRow
              event={item}
              isWatched={watchlistIds.has(item.id)}
              onOpen={() => openEvent(item)}
              onToggleWatchlist={() => toggleWatchlist(item.id)}
            />
          )}
          ListFooterComponent={
            isLoadingMore ? (
              <View style={styles.footerLoader}>
                <ActivityIndicator color="#d4ff62" size="small" />
              </View>
            ) : null
          }
          ListEmptyComponent={
            <View style={styles.centerState}>
              <Text style={styles.mutedText}>No markets found</Text>
              <Pressable
                onPress={() => {
                  setSearch("");
                  setCategory("All");
                  setSort("volume");
                }}
                style={styles.clearButton}
              >
                <Text style={styles.clearButtonText}>Clear Filters</Text>
              </Pressable>
            </View>
          }
        />
      )}

      <MarketDetailSheet
        event={selectedEvent}
        onClose={() => setSelectedEvent(null)}
        token={token}
        walletAddress={walletAddress}
      />
    </KeyboardAvoidingView>
  );
}

function MarketRow({
  event,
  isWatched,
  onOpen,
  onToggleWatchlist,
}: {
  event: PredictionEvent;
  isWatched: boolean;
  onOpen: () => void;
  onToggleWatchlist: () => void;
}) {
  const price = event.markets[0]?.outcomePrices?.[0] ?? event.markets[0]?.lastTradePrice ?? 0;

  return (
    <Pressable onPress={onOpen} style={styles.marketRow}>
      <View style={styles.marketMain}>
        <Text numberOfLines={3} style={styles.marketTitle}>
          {event.title || event.markets[0]?.question || "Untitled market"}
        </Text>
        <Text style={styles.marketMeta}>
          {event.category || "Market"} · ${Math.round(event.volume).toLocaleString()} vol
        </Text>
      </View>
      <View style={styles.marketAside}>
        <Pressable onPress={onToggleWatchlist} style={styles.watchButton}>
          <Text style={[styles.watchButtonText, isWatched && styles.watchButtonTextActive]}>
            {isWatched ? "Saved" : "Save"}
          </Text>
        </Pressable>
        <Text style={styles.priceText}>{Math.round(price * 100)}%</Text>
      </View>
    </Pressable>
  );
}

type TradeState = "idle" | "building" | "simulating" | "signing" | "submitted";

function MarketDetailSheet({
  event,
  onClose,
  token,
  walletAddress,
}: {
  event: PredictionEvent | null;
  onClose: () => void;
  token: string;
  walletAddress: string;
}) {
  const [amount, setAmount] = useState("1");
  const [selectedOutcome, setSelectedOutcome] = useState<TradeOutcome>("YES");
  const [tradeState, setTradeState] = useState<TradeState>("idle");
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const trade = useMobileJupiterPredict(token);

  const market = event?.markets[0];
  const parsedAmount = useMemo(() => Number(amount), [amount]);
  const price = market?.outcomePrices?.[selectedOutcome === "YES" ? 0 : 1] ?? market?.lastTradePrice ?? 0.5;
  const estimatedShares = price > 0 ? parsedAmount / price : 0;
  const priceImpact = market?.volume ? (parsedAmount / market.volume) * 100 : 0;

  const resetTrade = useCallback(() => {
    setTradeState("idle");
    setTradeError(null);
    setTxId(null);
    setRetryCount(0);
  }, []);

  const submitTrade = useCallback(async () => {
    if (!event || !market) return;
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setTradeError("Amount must be greater than zero.");
      return;
    }

    hapticMedium();
    setTradeError(null);
    setTxId(null);
    setTradeState("building");

    try {
      setTradeState("simulating");
      const signature = await trade.openPosition({
        amount: parsedAmount,
        marketId: market.id,
        outcome: selectedOutcome,
      });

      setTradeState("submitted");
      const finalTxId = Array.isArray(signature) ? signature[0] : signature;
      setTxId(finalTxId);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Trade failed";

      // Structured error messages (Req 11)
      if (/insufficient|not enough|balance/i.test(message)) {
        setTradeError(`Insufficient balance. You need at least ${parsedAmount} USDC to place this trade.`);
      } else if (/closed|expired/i.test(message)) {
        setTradeError("This market has closed. Refresh to see updated status.");
      } else if (/timeout|timed out/i.test(message)) {
        setTradeError("Wallet request timed out. Reopen your wallet and try again.");
      } else if (/network|connection|fetch/i.test(message)) {
        setTradeError("Network error. Check your connection and try again.");
      } else if (/cancel/i.test(message)) {
        // User cancelled MWA — silent reset
        setTradeState("idle");
        return;
      } else {
        setTradeError(message.length > 120 ? `${message.slice(0, 117)}...` : message);
      }

      setTradeState("idle");
      console.warn("[Trade Error]", { marketId: market.id, outcome: selectedOutcome, amount: parsedAmount, error: message });
    }
  }, [event, market, parsedAmount, selectedOutcome, trade]);

  const handleRetry = useCallback(() => {
    if (retryCount >= 3) return;
    setRetryCount((c) => c + 1);
    submitTrade();
  }, [retryCount, submitTrade]);

  return (
    <BottomSheet visible={Boolean(event)} onClose={onClose} heightFraction={0.85}>
      <ScrollView contentContainerStyle={styles.sheetContent}>
        <Text style={styles.detailTitle}>{event?.title}</Text>
        <Text style={styles.detailDescription}>
          {event?.description || market?.description}
        </Text>

        {tradeState === "submitted" && txId ? (
          <View style={styles.successCard}>
            <Text style={styles.successText}>Trade submitted</Text>
            <Pressable
              onPress={() => Linking.openURL(`https://solscan.io/tx/${txId}`)}
              style={styles.txLink}
            >
              <Text style={styles.txLinkText}>{txId.slice(0, 8)}...{txId.slice(-8)}</Text>
            </Pressable>
            <Pressable onPress={resetTrade} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>New Trade</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.outcomeRow}>
              {(["YES", "NO"] as TradeOutcome[]).map((outcome) => (
                <Pressable
                  key={outcome}
                  onPress={() => setSelectedOutcome(outcome)}
                  style={[
                    styles.outcomeButton,
                    selectedOutcome === outcome && styles.outcomeButtonActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.outcomeButtonText,
                      selectedOutcome === outcome && styles.outcomeButtonTextActive,
                    ]}
                  >
                    {outcome}
                  </Text>
                </Pressable>
              ))}
            </View>

            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setAmount}
              placeholder="Amount USDC"
              placeholderTextColor="#6f776a"
              style={styles.amountInput}
              value={amount}
            />

            {parsedAmount > 0 && (
              <View style={styles.estimateRow}>
                <Text style={styles.estimateText}>
                  ~{estimatedShares.toFixed(4)} shares · {priceImpact.toFixed(2)}% impact
                </Text>
                <Text style={styles.estimateText}>
                  Fee payer: {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
                </Text>
              </View>
            )}

            {tradeState !== "idle" && tradeState !== "submitted" && (
              <View style={styles.stepsCard}>
                <StepIndicator label="Building transaction" active={tradeState === "building"} done={tradeState !== "building"} />
                <StepIndicator label="Simulating" active={tradeState === "simulating"} done={tradeState === "signing"} />
                <StepIndicator label="Requesting signature" active={tradeState === "signing"} done={false} />
              </View>
            )}

            {tradeError && (
              <View style={styles.errorCard}>
                <Text style={styles.tradeErrorText}>{tradeError}</Text>
                <View style={styles.errorActions}>
                  {retryCount < 3 && /network|connection/i.test(tradeError) && (
                    <Pressable onPress={handleRetry} style={styles.retryButton}>
                      <Text style={styles.retryButtonText}>Retry</Text>
                    </Pressable>
                  )}
                  <Pressable onPress={resetTrade} style={styles.dismissButton}>
                    <Text style={styles.dismissButtonText}>Dismiss</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable
              disabled={tradeState !== "idle" || trade.isTrading}
              onPress={submitTrade}
              style={[
                styles.primaryButton,
                (tradeState !== "idle" || trade.isTrading) && styles.disabledButton,
              ]}
            >
              <Text style={styles.primaryButtonText}>
                {tradeState !== "idle" ? "Processing..." : "Build Trade"}
              </Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </BottomSheet>
  );
}

function StepIndicator({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <View style={styles.stepRow}>
      {active ? (
        <ActivityIndicator color="#d4ff62" size="small" />
      ) : (
        <View style={[styles.stepDot, done && styles.stepDotDone]} />
      )}
      <Text style={[styles.stepLabel, active && styles.stepLabelActive, done && styles.stepLabelDone]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  amountInput: {
    backgroundColor: "#11170f",
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f4f7ef",
    fontSize: 18,
    marginBottom: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  categoryPill: {
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  categoryPillActive: {
    backgroundColor: "#d4ff62",
    borderColor: "#d4ff62",
  },
  categoryScroller: {
    flexGrow: 0,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  categoryText: {
    color: "#aab3a3",
    fontWeight: "700",
  },
  categoryTextActive: {
    color: "#11170f",
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  clearButton: {
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  clearButtonText: {
    color: "#f4f7ef",
    fontWeight: "700",
  },
  container: {
    flex: 1,
  },
  detailDescription: {
    color: "#aab3a3",
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  detailTitle: {
    color: "#f4f7ef",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 10,
  },
  disabledButton: {
    opacity: 0.5,
  },
  dismissButton: {
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  dismissButtonText: {
    color: "#f4f7ef",
    fontWeight: "700",
  },
  errorActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 10,
  },
  errorCard: {
    backgroundColor: "#1a0f0f",
    borderColor: "#6b2a22",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  errorText: {
    color: "#ff9f8f",
    lineHeight: 22,
    textAlign: "center",
  },
  estimateRow: {
    gap: 4,
    marginBottom: 14,
  },
  estimateText: {
    color: "#6f776a",
    fontSize: 13,
  },
  footerLoader: {
    alignItems: "center",
    paddingVertical: 16,
  },
  marketAside: {
    alignItems: "flex-end",
    gap: 10,
  },
  marketMain: {
    flex: 1,
    paddingRight: 12,
  },
  marketMeta: {
    color: "#6f776a",
    fontSize: 13,
    marginTop: 8,
  },
  marketRow: {
    borderBottomColor: "#243020",
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingVertical: 16,
  },
  marketTitle: {
    color: "#f4f7ef",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0,
    lineHeight: 22,
  },
  mutedText: {
    color: "#aab3a3",
    lineHeight: 20,
    textAlign: "center",
  },
  outcomeButton: {
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  outcomeButtonActive: {
    backgroundColor: "#d4ff62",
    borderColor: "#d4ff62",
  },
  outcomeButtonText: {
    color: "#aab3a3",
    fontWeight: "800",
    textAlign: "center",
  },
  outcomeButtonTextActive: {
    color: "#11170f",
  },
  outcomeRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  priceText: {
    color: "#d4ff62",
    fontSize: 18,
    fontWeight: "800",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#d4ff62",
    borderRadius: 8,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#11170f",
    fontWeight: "800",
  },
  retryButton: {
    backgroundColor: "#d4ff62",
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  retryButtonText: {
    color: "#11170f",
    fontWeight: "800",
  },
  searchInput: {
    backgroundColor: "#11170f",
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    color: "#f4f7ef",
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 12,
    paddingVertical: 12,
  },
  secondaryButtonText: {
    color: "#f4f7ef",
    fontWeight: "700",
  },
  sheetContent: {
    padding: 20,
    paddingBottom: 40,
  },
  sortPill: {
    borderColor: "#1c2618",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  sortPillActive: {
    backgroundColor: "#172011",
    borderColor: "#d4ff62",
  },
  sortRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 10,
    paddingHorizontal: 16,
  },
  sortText: {
    color: "#6f776a",
    fontSize: 12,
    fontWeight: "700",
  },
  sortTextActive: {
    color: "#d4ff62",
  },
  stepDot: {
    backgroundColor: "#293322",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  stepDotDone: {
    backgroundColor: "#d4ff62",
  },
  stepLabel: {
    color: "#6f776a",
    fontSize: 13,
    fontWeight: "700",
  },
  stepLabelActive: {
    color: "#f4f7ef",
  },
  stepLabelDone: {
    color: "#d4ff62",
  },
  stepRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 6,
  },
  stepsCard: {
    backgroundColor: "#11170f",
    borderColor: "#243020",
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 14,
    padding: 14,
  },
  successCard: {
    alignItems: "center",
    backgroundColor: "#11170f",
    borderColor: "#243020",
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 20,
  },
  successText: {
    color: "#d4ff62",
    fontSize: 18,
    fontWeight: "800",
  },
  tradeErrorText: {
    color: "#ff9f8f",
    fontSize: 14,
    lineHeight: 20,
  },
  txLink: {
    borderBottomColor: "#d4ff62",
    borderBottomWidth: 1,
    paddingBottom: 2,
  },
  txLinkText: {
    color: "#d4ff62",
    fontSize: 13,
    fontWeight: "700",
  },
  watchButton: {
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  watchButtonText: {
    color: "#f4f7ef",
    fontSize: 12,
    fontWeight: "700",
  },
  watchButtonTextActive: {
    color: "#d4ff62",
  },
});

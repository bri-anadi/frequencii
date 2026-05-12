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
  Image,
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

        // Filter out ended/closed events
        const activeEvents = response.events.filter((e: PredictionEvent) => {
          if (e.closed) return false;
          if (e.endDate) {
            const end = new Date(e.endDate).getTime();
            if (end > 0 && end < Date.now()) return false;
          }
          return true;
        });

        if (append) {
          setEvents((current) => [...current, ...activeEvents]);
        } else {
          setEvents(activeEvents);
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
  const market = event.markets?.[0];
  const rawYes = market?.outcomePrices?.[0] ?? 0.5;
  const rawNo = market?.outcomePrices?.[1] ?? 0.5;
  // Use lastTradePrice if outcomePrices are default 0.5/0.5
  const yesPrice = (rawYes === 0.5 && market?.lastTradePrice) ? market.lastTradePrice : rawYes;
  const noPrice = (rawNo === 0.5 && market?.lastTradePrice) ? (1 - market.lastTradePrice) : rawNo;
  const yesPercent = yesPrice * 100;
  const noPercent = noPrice * 100;

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  const getDaysLeft = (dateStr: string | undefined) => {
    if (!dateStr) return null;
    try {
      const diff = new Date(dateStr).getTime() - Date.now();
      if (diff <= 0) return "Ended";
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      return days === 1 ? "1d left" : `${days}d left`;
    } catch {
      return null;
    }
  };

  const daysLeft = getDaysLeft(event.endDate);

  return (
    <Pressable onPress={onOpen} style={styles.marketCard}>
      {/* Image + Title row */}
      <View style={styles.marketCardHeader}>
        {event.image ? (
          <Image
            source={{ uri: event.image }}
            style={styles.marketImage}
            resizeMode="cover"
          />
        ) : (
          <View style={[styles.marketImage, styles.marketImageFallback]}>
            <Text style={styles.marketImagePlaceholder}>📊</Text>
          </View>
        )}
        <View style={styles.marketTitleBlock}>
          <Text numberOfLines={2} style={styles.marketTitle}>
            {event.title || market?.question || "Untitled market"}
          </Text>
          {/* Meta row: category · days left */}
          <View style={styles.metaRow}>
            {event.category ? (
              <Text style={styles.metaText}>{event.category}</Text>
            ) : null}
            {daysLeft ? (
              <>
                <Text style={styles.metaDot}>·</Text>
                <Text style={styles.metaText}>{daysLeft}</Text>
              </>
            ) : null}
          </View>
        </View>
      </View>

      {/* Description */}
      {event.description ? (
        <Text numberOfLines={2} style={styles.descriptionText}>
          {event.description}
        </Text>
      ) : null}

      {/* Odds bar */}
      <View style={styles.oddsBar}>
        <View style={[styles.oddsYes, { flex: yesPercent }]} />
        <View style={[styles.oddsNo, { flex: 100 - yesPercent }]} />
      </View>

      {/* Odds + Volume row */}
      <View style={styles.oddsRow}>
        <View style={styles.oddsLabels}>
          <Text style={styles.yesText}>Yes {yesPercent.toFixed(1)}¢</Text>
          <Text style={styles.oddsDivider}>/</Text>
          <Text style={styles.noText}>No {noPercent.toFixed(1)}¢</Text>
        </View>
        <Text style={styles.volumeText}>{formatVolume(event.volume)}</Text>
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
  const [selectedMarketIdx, setSelectedMarketIdx] = useState(0);
  const [selectedOutcome, setSelectedOutcome] = useState<TradeOutcome>("YES");
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [tradeState, setTradeState] = useState<TradeState>("idle");

  // Fetch wallet balance when sheet opens
  useEffect(() => {
    if (!event || !walletAddress) return;
    const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
    fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [walletAddress] }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.result?.value != null) setWalletBalance(data.result.value / 1e9);
      })
      .catch(() => {});
  }, [event, walletAddress]);
  const [tradeError, setTradeError] = useState<string | null>(null);
  const [txId, setTxId] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const trade = useMobileJupiterPredict(token);

  const market = event?.markets[selectedMarketIdx] ?? event?.markets[0];
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
    <BottomSheet visible={Boolean(event)} onClose={onClose} heightFraction={0.9}>
      <ScrollView contentContainerStyle={styles.sheetContent}>
        {/* Hero Image */}
        {event?.image ? (
          <Image
            source={{ uri: event.image }}
            style={styles.detailImage}
            resizeMode="cover"
          />
        ) : null}

        {/* Title */}
        <Text style={styles.detailTitle}>{event?.title}</Text>

        {/* Category + Days left */}
        <View style={styles.detailMetaRow}>
          {event?.category ? (
            <View style={styles.detailCategoryPill}>
              <Text style={styles.detailCategoryText}>{event.category}</Text>
            </View>
          ) : null}
          {event?.endDate ? (
            <Text style={styles.detailMetaText}>
              {(() => {
                const diff = new Date(event.endDate).getTime() - Date.now();
                if (diff <= 0) return "Ended";
                const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
                return `${days} days left`;
              })()}
            </Text>
          ) : null}
        </View>

        {/* All Markets / Options */}
        {event?.markets && event.markets.length > 0 && (
          <View style={styles.marketsSection}>
            {event.markets.map((m, idx) => {
              const mYes = m.outcomePrices?.[0] ?? 0.5;
              const mNo = m.outcomePrices?.[1] ?? 0.5;
              // Use lastTradePrice as the real price when outcomePrices are default
              const realYes = (mYes === 0.5 && m.lastTradePrice && m.lastTradePrice !== 0.5)
                ? m.lastTradePrice : mYes;
              const realNo = (mNo === 0.5 && m.lastTradePrice && m.lastTradePrice !== 0.5)
                ? (1 - m.lastTradePrice) : mNo;
              const isSelected = idx === selectedMarketIdx;

              // Per-market volume is in SOL units from API
              const marketVol = m.volume ?? 0;

              return (
                <View key={m.id} style={[styles.optionCard, isSelected && styles.optionCardSelected]}>
                  <View style={styles.optionHeader}>
                    <Text numberOfLines={1} style={styles.optionTitle}>{m.question || "Option"}</Text>
                    <Text style={styles.optionPercent}>{(realYes * 100).toFixed(0)}%</Text>
                  </View>
                  {marketVol > 0 && (
                    <Text style={styles.optionVolume}>
                      {marketVol >= 1000 ? `${(marketVol / 1000).toFixed(1)}K` : marketVol.toFixed(1)} SOL vol
                    </Text>
                  )}
                  <View style={styles.optionOddsRow}>
                    <Pressable
                      onPress={() => { setSelectedMarketIdx(idx); setSelectedOutcome("YES"); }}
                      style={[styles.optionYesPill, isSelected && selectedOutcome === "YES" && styles.optionYesPillActive]}
                    >
                      <Text style={[styles.optionYesText, isSelected && selectedOutcome === "YES" && styles.optionYesTextActive]}>Yes {(realYes * 100).toFixed(1)}¢</Text>
                    </Pressable>
                    <Pressable
                      onPress={() => { setSelectedMarketIdx(idx); setSelectedOutcome("NO"); }}
                      style={[styles.optionNoPill, isSelected && selectedOutcome === "NO" && styles.optionNoPillActive]}
                    >
                      <Text style={[styles.optionNoText, isSelected && selectedOutcome === "NO" && styles.optionNoTextActive]}>No {(realNo * 100).toFixed(1)}¢</Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Volume / 24h / End Date stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>Volume</Text>
            <Text style={styles.statValue}>
              {event?.volume ? (event.volume >= 1_000_000 ? `$${(event.volume / 1_000_000).toFixed(1)}M` : event.volume >= 1_000 ? `$${(event.volume / 1_000).toFixed(1)}K` : `$${event.volume.toFixed(0)}`) : "$0"}
            </Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>24h Volume</Text>
            <Text style={styles.statValue}>
              {(event as any)?.volume24hr ? ((event as any).volume24hr >= 1_000_000 ? `$${((event as any).volume24hr / 1_000_000).toFixed(1)}M` : `$${((event as any).volume24hr / 1_000).toFixed(1)}K`) : "—"}
            </Text>
          </View>
          <View style={styles.statBlock}>
            <Text style={styles.statLabel}>End Date</Text>
            <Text style={styles.statValue}>
              {event?.endDate ? new Date(event.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
            </Text>
          </View>
        </View>

        {/* Description */}
        {(event?.description || market?.description) ? (
          <View style={styles.descriptionSection}>
            <Text style={styles.descriptionLabel}>Description</Text>
            <Text style={styles.detailDescription}>
              {event?.description || market?.description}
            </Text>
          </View>
        ) : null}

        {/* Trade Section */}
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
            <View style={styles.tradeSection}>
              <Text style={styles.tradeSectionTitle}>Trade Privately</Text>
              {market && (
                <Text style={styles.tradeMarketName}>
                  {market.question || event?.title || "Selected market"}
                </Text>
              )}

              {/* Yes/No with real prices */}
              <View style={styles.outcomeRow}>
                <Pressable
                  onPress={() => setSelectedOutcome("YES")}
                  style={[styles.outcomeButton, selectedOutcome === "YES" && styles.outcomeButtonYesActive]}
                >
                  <Text style={[styles.outcomeButtonText, selectedOutcome === "YES" && styles.outcomeButtonTextActive]}>
                    YES ({(price * 100).toFixed(1)}¢)
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setSelectedOutcome("NO")}
                  style={[styles.outcomeButton, selectedOutcome === "NO" && styles.outcomeButtonNoActive]}
                >
                  <Text style={[styles.outcomeButtonText, selectedOutcome === "NO" && styles.outcomeButtonNoTextActive]}>
                    NO ({((1 - price) * 100).toFixed(1)}¢)
                  </Text>
                </Pressable>
              </View>

              {/* Amount input */}
              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>Amount (SOL)</Text>
                <Text style={styles.balanceHint}>
                  Balance: {walletBalance != null ? `${walletBalance.toFixed(4)} SOL` : "— SOL"}
                </Text>
              </View>
              <TextInput
                keyboardType="decimal-pad"
                onChangeText={setAmount}
                placeholder="0.1"
                placeholderTextColor="#6f776a"
                style={styles.amountInput}
                value={amount}
              />

              {/* Insufficient balance warning */}
              {walletBalance != null && walletBalance < 0.001 && (
                <View style={styles.topupWarning}>
                  <Text style={styles.topupWarningText}>
                    Insufficient balance. Please top up your wallet to trade.
                  </Text>
                </View>
              )}

              {walletBalance != null && parsedAmount > walletBalance && walletBalance >= 0.001 && (
                <View style={styles.topupWarning}>
                  <Text style={styles.topupWarningText}>
                    Insufficient balance: {walletBalance.toFixed(4)} SOL. Need at least {parsedAmount} SOL.
                  </Text>
                </View>
              )}

              {/* Trade estimate card */}
              {parsedAmount > 0 && (
                <View style={styles.estimateCard}>
                  <View style={styles.estimateItem}>
                    <Text style={styles.estimateLabel}>Implied probability</Text>
                    <Text style={styles.estimateValue}>{(price * 100).toFixed(1)}¢</Text>
                  </View>
                  <View style={styles.estimateItem}>
                    <Text style={styles.estimateLabel}>Potential payout</Text>
                    <Text style={styles.estimateValue}>{(parsedAmount / price).toFixed(4)} SOL</Text>
                  </View>
                  <View style={styles.estimateItem}>
                    <Text style={styles.estimateLabel}>Potential profit</Text>
                    <Text style={styles.estimateProfit}>+{((parsedAmount / price) - parsedAmount).toFixed(4)} SOL</Text>
                  </View>
                </View>
              )}

              <Text style={styles.privacyNote}>
                This trade will be signed by your private wallet. Your main wallet identity is not linked to this position.
              </Text>
            </View>

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
    borderRadius: 16,
    borderWidth: 1,
    marginRight: 8,
    minHeight: 36,
    paddingHorizontal: 14,
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
    fontSize: 13,
    fontWeight: "600",
  },
  categoryTextActive: {
    color: "#11170f",
    fontSize: 13,
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
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 16,
  },
  detailImage: {
    borderRadius: 12,
    height: 180,
    marginBottom: 16,
    width: "100%",
  },
  detailMetaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  detailMetaText: {
    color: "#aab3a3",
    fontSize: 13,
  },
  detailCategoryPill: {
    backgroundColor: "#1c2618",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  detailCategoryText: {
    color: "#f4f7ef",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  detailTitle: {
    color: "#f4f7ef",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
    marginBottom: 10,
  },
  descriptionSection: {
    borderTopColor: "#1c2618",
    borderTopWidth: 1,
    marginBottom: 16,
    paddingTop: 14,
  },
  descriptionLabel: {
    color: "#6f776a",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 6,
    textTransform: "uppercase",
  },
  marketsSection: {
    gap: 8,
    marginBottom: 16,
  },
  optionCard: {
    backgroundColor: "#11170f",
    borderColor: "#243020",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 12,
  },
  optionCardSelected: {
    borderColor: "#d4ff62",
  },
  optionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  optionTitle: {
    color: "#f4f7ef",
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
  },
  optionPercent: {
    color: "#f4f7ef",
    fontSize: 20,
    fontWeight: "800",
  },
  optionVolume: {
    color: "#6f776a",
    fontSize: 12,
  },
  optionOddsRow: {
    flexDirection: "row",
    gap: 8,
  },
  optionYesPill: {
    borderColor: "#4ade80",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionYesPillActive: {
    backgroundColor: "#4ade80",
  },
  optionYesText: {
    color: "#4ade80",
    fontSize: 13,
    fontWeight: "700",
  },
  optionYesTextActive: {
    color: "#ffffff",
  },
  optionNoPill: {
    borderColor: "#ef4444",
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  optionNoPillActive: {
    backgroundColor: "#ef4444",
  },
  optionNoText: {
    color: "#ef4444",
    fontSize: 13,
    fontWeight: "700",
  },
  optionNoTextActive: {
    color: "#ffffff",
  },
  statsRow: {
    borderTopColor: "#1c2618",
    borderTopWidth: 1,
    flexDirection: "row",
    marginBottom: 16,
    paddingTop: 14,
  },
  statBlock: {
    flex: 1,
    gap: 4,
  },
  statLabel: {
    color: "#6f776a",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  statValue: {
    color: "#f4f7ef",
    fontSize: 15,
    fontWeight: "800",
  },
  tradeSection: {
    borderTopColor: "#1c2618",
    borderTopWidth: 1,
    gap: 12,
    marginBottom: 14,
    paddingTop: 14,
  },
  tradeSectionTitle: {
    color: "#f4f7ef",
    fontSize: 20,
    fontWeight: "800",
  },
  tradeMarketName: {
    color: "#aab3a3",
    fontSize: 14,
    lineHeight: 18,
  },
  outcomeRow: {
    flexDirection: "row",
    gap: 10,
  },
  outcomeButton: {
    borderColor: "#293322",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 14,
  },
  outcomeButtonYesActive: {
    backgroundColor: "#f4f7ef",
    borderColor: "#f4f7ef",
  },
  outcomeButtonNoActive: {
    backgroundColor: "transparent",
    borderColor: "#ef4444",
  },
  outcomeButtonText: {
    color: "#aab3a3",
    fontWeight: "800",
    textAlign: "center",
  },
  outcomeButtonTextActive: {
    color: "#11170f",
  },
  outcomeButtonNoTextActive: {
    color: "#ef4444",
    fontWeight: "800",
    textAlign: "center",
  },
  amountRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  amountLabel: {
    color: "#f4f7ef",
    fontSize: 14,
    fontWeight: "700",
  },
  balanceHint: {
    color: "#6f776a",
    fontSize: 13,
  },
  estimateCard: {
    backgroundColor: "#11232a",
    borderColor: "#1c3a4a",
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
    padding: 14,
  },
  estimateItem: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  estimateLabel: {
    color: "#aab3a3",
    fontSize: 14,
  },
  estimateValue: {
    color: "#f4f7ef",
    fontSize: 14,
    fontWeight: "700",
  },
  estimateProfit: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "700",
  },
  privacyNote: {
    color: "#6f776a",
    fontSize: 12,
    fontStyle: "italic",
    lineHeight: 18,
  },
  topupWarning: {
    backgroundColor: "#1a0f0f",
    borderColor: "#6b2a22",
    borderRadius: 10,
    borderWidth: 1,
    padding: 12,
  },
  topupWarningText: {
    color: "#ff9f8f",
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
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
  footerLoader: {
    alignItems: "center",
    paddingVertical: 16,
  },
  marketCard: {
    backgroundColor: "#0c100b",
    borderColor: "#243020",
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
    padding: 14,
  },
  marketCardHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 12,
  },
  marketImage: {
    borderRadius: 8,
    height: 44,
    width: 44,
  },
  marketImageFallback: {
    alignItems: "center",
    backgroundColor: "#1c2618",
    justifyContent: "center",
  },
  marketImagePlaceholder: {
    fontSize: 20,
  },
  marketTitle: {
    color: "#f4f7ef",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  marketTitleBlock: {
    flex: 1,
    gap: 3,
  },
  descriptionText: {
    color: "#aab3a3",
    fontSize: 13,
    lineHeight: 18,
  },
  metaDot: {
    color: "#6f776a",
    fontSize: 12,
  },
  metaRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  metaText: {
    color: "#6f776a",
    fontSize: 12,
    textTransform: "capitalize",
  },
  noText: {
    color: "#ef4444",
    fontSize: 12,
    fontWeight: "700",
  },
  oddsBar: {
    borderRadius: 3,
    flexDirection: "row",
    height: 6,
    overflow: "hidden",
  },
  oddsDivider: {
    color: "#6f776a",
    fontSize: 12,
  },
  oddsLabels: {
    alignItems: "center",
    flexDirection: "row",
    gap: 5,
  },
  oddsNo: {
    backgroundColor: "#3a1c1c",
  },
  oddsRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  oddsYes: {
    backgroundColor: "#4ade80",
  },
  volumeText: {
    color: "#6f776a",
    fontSize: 12,
    fontWeight: "700",
  },
  yesText: {
    color: "#4ade80",
    fontSize: 12,
    fontWeight: "700",
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
    borderRadius: 14,
    borderWidth: 1,
    minHeight: 32,
    paddingHorizontal: 12,
    paddingVertical: 7,
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
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  watchButtonText: {
    color: "#6f776a",
    fontSize: 18,
  },
  watchButtonTextActive: {
    color: "#d4ff62",
  },
});

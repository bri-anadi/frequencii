import type { Position, PositionsResponse } from "@frequencii/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest } from "../../api/client";
import { BottomSheet } from "../../components/BottomSheet";
import { SkeletonList } from "../../components/SkeletonRow";
import { useMobileJupiterPredict } from "../trade/useMobileJupiterPredict";

export function PositionsScreen({
  token,
  walletAddress,
}: {
  token: string;
  walletAddress: string;
}) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPosition, setSelectedPosition] = useState<Position | null>(null);
  const trade = useMobileJupiterPredict(token);

  const loadPositions = useCallback(
    async (refresh = false) => {
      if (refresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);
      try {
        const response = await apiRequest<PositionsResponse | { data?: unknown[] }>(
          `/api/v1/positions?walletPubkey=${encodeURIComponent(walletAddress)}`,
          { token },
        );

        const rawPositions = Array.isArray((response as PositionsResponse).positions)
          ? (response as PositionsResponse).positions
          : Array.isArray((response as { data?: unknown[] }).data)
            ? ((response as { data?: unknown[] }).data as Position[])
            : [];

        setPositions(rawPositions);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load positions");
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [token, walletAddress],
  );

  useEffect(() => {
    loadPositions();
  }, [loadPositions]);

  const summary = useMemo(() => {
    const active = positions.filter((p) => !p.resolved);
    const totalValue = positions.reduce((sum, p) => sum + p.amount, 0);
    const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
    const totalPnlPercent =
      totalValue > 0 ? (totalPnl / totalValue) * 100 : 0;
    return { activeCount: active.length, totalValue, totalPnl, totalPnlPercent };
  }, [positions]);

  const categoryBreakdown = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const p of positions) {
      const cat = p.marketTitle?.split(" ")[0]?.toLowerCase() || "other";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    const total = positions.length || 1;
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, count]) => ({ name, count, pct: (count / total) * 100 }));
  }, [positions]);

  if (isLoading && positions.length === 0) {
    return <SkeletonList count={5} />;
  }

  if (error && positions.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable onPress={() => loadPositions()} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (positions.length === 0) {
    return (
      <View style={styles.centerState}>
        <Text style={styles.emptyTitle}>No positions yet</Text>
        <Text style={styles.mutedText}>
          Start trading to see your portfolio here.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={positions}
        keyExtractor={(item, index) => `${item.marketId}-${index}`}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            tintColor="#d4ff62"
            onRefresh={() => loadPositions(true)}
          />
        }
        ListHeaderComponent={
          <>
            <PortfolioSummary summary={summary} />
            <PnlChart positions={positions} />
            {categoryBreakdown.length > 0 && (
              <CategoryBreakdown data={categoryBreakdown} />
            )}
          </>
        }
        renderItem={({ item }) => (
          <PositionRow
            item={item}
            isClaiming={trade.isTrading}
            onPress={() => setSelectedPosition(item)}
            onClaim={async () => {
              const positionId = item.id ?? item.positionId;
              if (!positionId) {
                Alert.alert("Cannot claim", "This position does not include a claim ID.");
                return;
              }
              try {
                const signature = await trade.claimPayout(positionId);
                Alert.alert("Claim submitted", signature);
                await loadPositions();
              } catch (err) {
                Alert.alert("Claim failed", err instanceof Error ? err.message : "Try again.");
              }
            }}
          />
        )}
      />

      <PositionDetailSheet
        position={selectedPosition}
        onClose={() => setSelectedPosition(null)}
      />
    </View>
  );
}

function PortfolioSummary({
  summary,
}: {
  summary: { activeCount: number; totalValue: number; totalPnl: number; totalPnlPercent: number };
}) {
  const pnlColor =
    summary.totalPnl > 0 ? "#4ade80" : summary.totalPnl < 0 ? "#ff9f8f" : "#aab3a3";

  return (
    <View style={styles.summaryCard}>
      <View style={styles.summaryRow}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Total Value</Text>
          <Text style={styles.summaryValue}>${summary.totalValue.toFixed(2)}</Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>PnL</Text>
          <Text style={[styles.summaryValue, { color: pnlColor }]}>
            {summary.totalPnl >= 0 ? "+" : ""}
            {summary.totalPnl.toFixed(2)} ({summary.totalPnlPercent.toFixed(1)}%)
          </Text>
        </View>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryLabel}>Active</Text>
          <Text style={styles.summaryValue}>{summary.activeCount}</Text>
        </View>
      </View>
    </View>
  );
}

function PnlChart({ positions }: { positions: Position[] }) {
  const maxPnl = Math.max(...positions.map((p) => Math.abs(p.pnl)), 1);

  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>PnL by Position</Text>
      <View style={styles.chartBars}>
        {positions.slice(0, 10).map((p, i) => {
          const width = Math.max((Math.abs(p.pnl) / maxPnl) * 100, 4);
          const isPositive = p.pnl >= 0;
          return (
            <View key={`${p.marketId}-${i}`} style={styles.barRow}>
              <Text numberOfLines={1} style={styles.barLabel}>
                {p.marketTitle?.slice(0, 20) || p.marketId.slice(0, 8)}
              </Text>
              <View style={styles.barTrack}>
                <View
                  style={[
                    styles.bar,
                    {
                      width: `${width}%`,
                      backgroundColor: isPositive ? "#4ade80" : "#ff9f8f",
                    },
                  ]}
                />
              </View>
              <Text style={[styles.barValue, { color: isPositive ? "#4ade80" : "#ff9f8f" }]}>
                {p.pnl >= 0 ? "+" : ""}{p.pnl.toFixed(2)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

function CategoryBreakdown({ data }: { data: { name: string; count: number; pct: number }[] }) {
  return (
    <View style={styles.chartCard}>
      <Text style={styles.chartTitle}>By Category</Text>
      {data.map((item) => (
        <View key={item.name} style={styles.catRow}>
          <Text style={styles.catName}>{item.name}</Text>
          <View style={styles.catBarTrack}>
            <View style={[styles.catBar, { width: `${item.pct}%` }]} />
          </View>
          <Text style={styles.catCount}>{item.count}</Text>
        </View>
      ))}
    </View>
  );
}

function PositionRow({
  item,
  isClaiming,
  onPress,
  onClaim,
}: {
  item: Position;
  isClaiming: boolean;
  onPress: () => void;
  onClaim: () => Promise<void>;
}) {
  return (
    <Pressable onPress={onPress} style={styles.positionRow}>
      <View style={styles.positionMain}>
        <View style={styles.positionTitleRow}>
          <Text numberOfLines={1} style={styles.positionTitle}>
            {item.marketTitle || item.marketId}
          </Text>
          {item.claimable && <Text style={styles.claimBadge}>Claimable</Text>}
        </View>
        <Text style={styles.positionMeta}>
          {item.outcome} · ${item.amount.toFixed(2)} · PnL{" "}
          <Text style={{ color: item.pnl >= 0 ? "#4ade80" : "#ff9f8f" }}>
            {item.pnl >= 0 ? "+" : ""}{item.pnl.toFixed(2)}
          </Text>
        </Text>
      </View>
      {item.claimable && (
        <Pressable disabled={isClaiming} onPress={onClaim} style={styles.claimButton}>
          <Text style={styles.claimButtonText}>{isClaiming ? "..." : "Claim"}</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

function PositionDetailSheet({
  position,
  onClose,
}: {
  position: Position | null;
  onClose: () => void;
}) {
  if (!position) return null;

  const statusLabel = position.claimable
    ? "Claimable"
    : position.resolved
      ? "Resolved"
      : "Active";
  const statusColor = position.claimable
    ? "#d4ff62"
    : position.resolved
      ? "#aab3a3"
      : "#4ade80";

  return (
    <BottomSheet visible={Boolean(position)} onClose={onClose} heightFraction={0.5}>
      <ScrollView contentContainerStyle={styles.detailContent}>
        <Text style={styles.detailTitle}>{position.marketTitle || position.marketId}</Text>
        <View style={styles.detailGrid}>
          <DetailItem label="Outcome" value={position.outcome} />
          <DetailItem label="Entry Price" value={`$${position.entryPrice.toFixed(4)}`} />
          <DetailItem label="Current Price" value={`$${position.currentPrice.toFixed(4)}`} />
          <DetailItem label="Amount" value={`$${position.amount.toFixed(2)}`} />
          <DetailItem
            label="PnL"
            value={`${position.pnl >= 0 ? "+" : ""}${position.pnl.toFixed(2)} (${position.pnlPercent.toFixed(1)}%)`}
            color={position.pnl >= 0 ? "#4ade80" : "#ff9f8f"}
          />
          <DetailItem label="Status" value={statusLabel} color={statusColor} />
        </View>
      </ScrollView>
    </BottomSheet>
  );
}

function DetailItem({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={styles.detailItem}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={[styles.detailValue, color ? { color } : undefined]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    borderRadius: 3,
    height: 6,
  },
  barLabel: {
    color: "#aab3a3",
    fontSize: 11,
    width: 80,
  },
  barRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  barTrack: {
    backgroundColor: "#1c2618",
    borderRadius: 3,
    flex: 1,
    height: 6,
  },
  barValue: {
    fontSize: 11,
    fontWeight: "700",
    textAlign: "right",
    width: 50,
  },
  catBar: {
    backgroundColor: "#d4ff62",
    borderRadius: 3,
    height: 6,
  },
  catBarTrack: {
    backgroundColor: "#1c2618",
    borderRadius: 3,
    flex: 1,
    height: 6,
  },
  catCount: {
    color: "#aab3a3",
    fontSize: 12,
    fontWeight: "700",
    textAlign: "right",
    width: 24,
  },
  catName: {
    color: "#f4f7ef",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "capitalize",
    width: 70,
  },
  catRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    paddingVertical: 4,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  chartBars: {
    gap: 2,
    marginTop: 10,
  },
  chartCard: {
    backgroundColor: "#0c100b",
    borderColor: "#243020",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    marginHorizontal: 16,
    padding: 14,
  },
  chartTitle: {
    color: "#f4f7ef",
    fontSize: 14,
    fontWeight: "800",
  },
  claimBadge: {
    backgroundColor: "#d4ff62",
    borderRadius: 4,
    color: "#11170f",
    fontSize: 10,
    fontWeight: "900",
    overflow: "hidden",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  claimButton: {
    alignSelf: "flex-start",
    backgroundColor: "#d4ff62",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  claimButtonText: {
    color: "#11170f",
    fontWeight: "800",
  },
  detailContent: {
    padding: 20,
  },
  detailGrid: {
    gap: 14,
    marginTop: 16,
  },
  detailItem: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  detailLabel: {
    color: "#6f776a",
    fontSize: 14,
    fontWeight: "700",
  },
  detailTitle: {
    color: "#f4f7ef",
    fontSize: 20,
    fontWeight: "800",
  },
  detailValue: {
    color: "#f4f7ef",
    fontSize: 14,
    fontWeight: "800",
  },
  emptyTitle: {
    color: "#f4f7ef",
    fontSize: 18,
    fontWeight: "800",
  },
  errorText: {
    color: "#ff9f8f",
    textAlign: "center",
  },
  mutedText: {
    color: "#aab3a3",
    lineHeight: 20,
    textAlign: "center",
  },
  positionMain: {
    flex: 1,
  },
  positionMeta: {
    color: "#aab3a3",
    fontSize: 13,
    marginTop: 6,
  },
  positionRow: {
    alignItems: "center",
    borderBottomColor: "#243020",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  positionTitle: {
    color: "#f4f7ef",
    flex: 1,
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 21,
  },
  positionTitleRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
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
  screen: {
    flex: 1,
  },
  summaryCard: {
    backgroundColor: "#0c100b",
    borderColor: "#243020",
    borderRadius: 14,
    borderWidth: 1,
    margin: 16,
    marginBottom: 12,
    padding: 16,
  },
  summaryItem: {
    alignItems: "center",
    flex: 1,
  },
  summaryLabel: {
    color: "#6f776a",
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  summaryRow: {
    flexDirection: "row",
  },
  summaryValue: {
    color: "#f4f7ef",
    fontSize: 16,
    fontWeight: "800",
    marginTop: 4,
  },
});

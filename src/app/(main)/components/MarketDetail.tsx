import React, { useState } from "react";
import { Column, Row, Text, Button, Badge, IconButton } from "@once-ui-system/core";
import type { PredictionEvent, PredictionMarket } from "@/lib/types";

interface MarketDetailProps {
  event: PredictionEvent;
  onClose: () => void;
  onTrade?: (market: PredictionMarket) => void;
  isUnlocked?: boolean;
}

export const MarketDetail: React.FC<MarketDetailProps> = ({
  event,
  onClose,
  onTrade,
  isUnlocked = false,
}) => {
  const [showAllMarkets, setShowAllMarkets] = useState(false);

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
    return `$${Math.round(vol)}`;
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "N/A";
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  const getDaysLeft = (dateStr: string) => {
    if (!dateStr) return null;
    try {
      const diff = new Date(dateStr).getTime() - Date.now();
      if (diff <= 0) return "Ended";
      const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
      if (days === 1) return "1 day left";
      return `${days} days left`;
    } catch {
      return null;
    }
  };

  // Sort markets by highest Yes probability descending
  const sortedMarkets = [...event.markets].sort((a, b) => {
    const aYes = a.outcomePrices?.[0] || 0;
    const bYes = b.outcomePrices?.[0] || 0;
    return bYes - aYes;
  });

  const topMarketsCount = 5;
  const visibleMarkets = showAllMarkets ? sortedMarkets : sortedMarkets.slice(0, topMarketsCount);
  const hasMoreMarkets = sortedMarkets.length > topMarketsCount;

  return (
    <Column
      fillWidth
      fillHeight
      padding="m"
      gap="m"
      border="neutral-alpha-medium"
      radius="l"
      background="neutral-weak"
      style={{ overflowY: "auto", overflowX: "hidden", position: "relative" }}
    >
      {/* Top right close button */}
      <div style={{ position: "absolute", top: "16px", right: "16px", zIndex: 10 }}>
        <IconButton
          variant="secondary"
          icon="close"
          size="m"
          onClick={onClose}
          tooltip="Close"
        />
      </div>
      {/* Banner Image */}
      {event.image && (
        <div style={{
          width: '100%',
          height: '140px',
          borderRadius: '8px',
          overflow: 'hidden',
          marginBottom: '8px'
        }}>
          <img
            src={event.image}
            alt={event.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = 'none';
            }}
          />
        </div>
      )}

      <Row fillWidth vertical="center">
        <Text variant="heading-strong-s" style={{ maxWidth: "85%", paddingRight: "32px" }}>
          {event.title}
        </Text>
      </Row>

      {/* Category + time */}
      <Row gap="s" vertical="center">
        {event.category && (
          <Badge title={event.category.charAt(0).toUpperCase() + event.category.slice(1)} arrow={false} paddingX="12" paddingY="4" textSize="xs" />
        )}
        {getDaysLeft(event.endDate) && (
          <Text variant="body-default-xs" onBackground="neutral-weak">
            {getDaysLeft(event.endDate)}
          </Text>
        )}
      </Row>

      {/* Sub-Markets List */}
      <Column fillWidth style={{ marginTop: "8px" }}>
        <Column fillWidth>
          {visibleMarkets.map((market, index) => {
            const yesPrice = market?.outcomePrices?.[0] ?? 0;
            const noPrice = market?.outcomePrices?.[1] ?? Math.max(1 - yesPrice, 0.001);
            const yesChance = Math.round(yesPrice * 100);

            return (
              <Column
                key={market.id || index}
                fillWidth
                paddingY="m"
                paddingX="xs"
                gap="12"
                style={{
                  borderBottom: "1px solid var(--neutral-alpha-medium)",
                }}
              >
                {/* Row 1: Name and Chance */}
                <Row fillWidth vertical="center" justify="space-between">
                  <Column flex={1} gap="2" style={{ paddingRight: "16px" }}>
                    <Text variant="body-strong-s" style={{ whiteSpace: "normal" }}>
                      {market.question || event.title}
                    </Text>
                    <Text variant="body-default-xs" onBackground="neutral-weak">
                      ${market.volume?.toLocaleString() || "0"} vol
                    </Text>
                  </Column>

                  <Column align="end" justify="center">
                    <Text variant="heading-strong-m">
                      {yesChance}%
                    </Text>
                  </Column>
                </Row>

                {/* Row 2: Yes and No buttons */}
                {onTrade && (
                  <Row gap="s" fillWidth>
                    <Button
                      variant="secondary"
                      size="m"
                      disabled={!isUnlocked || !event.active}
                      onClick={() => onTrade(market)}
                      style={{ flex: 1, color: "var(--success-solid-strong)", borderColor: "var(--success-alpha-medium)", borderWidth: "1px" }}
                    >
                      Yes {(yesPrice * 100).toFixed(1)}¢
                    </Button>
                    <Button
                      variant="secondary"
                      size="m"
                      disabled={!isUnlocked || !event.active}
                      onClick={() => onTrade(market)}
                      style={{ flex: 1, color: "var(--brand-solid-strong)", borderColor: "var(--brand-alpha-medium)", borderWidth: "1px" }}
                    >
                      No {(noPrice * 100).toFixed(1)}¢
                    </Button>
                  </Row>
                )}
              </Column>
            );
          })}
        </Column>
        {hasMoreMarkets && (
          <Button
            variant="tertiary"
            size="s"
            onClick={() => setShowAllMarkets(!showAllMarkets)}
            style={{ marginTop: "4px" }}
          >
            {showAllMarkets ? "Show Less" : `Show ${sortedMarkets.length - topMarketsCount} More Options`}
          </Button>
        )}
      </Column>

      {/* Lock Warning */}
      {!isUnlocked && (
        <Text variant="body-default-xs" style={{ color: "var(--danger-solid-strong, #ef4444)", textAlign: "center", marginTop: "8px" }}>
          Setup or unlock Private Wallet to trade.
        </Text>
      )}

      {/* Stats */}
      <Row fillWidth gap="m" style={{ flexWrap: "wrap", marginTop: "16px" }}>
        <Column gap="2">
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Volume
          </Text>
          <Text variant="label-default-s">{formatVolume(event.volume)}</Text>
        </Column>
        <Column gap="2">
          <Text variant="body-default-xs" onBackground="neutral-weak">
            24h Volume
          </Text>
          <Text variant="label-default-s">{formatVolume(event.volume24hr)}</Text>
        </Column>
        <Column gap="2">
          <Text variant="body-default-xs" onBackground="neutral-weak">
            End Date
          </Text>
          <Text variant="label-default-s">{formatDate(event.endDate)}</Text>
        </Column>
      </Row>

      {/* Description */}
      {event.description && (
        <Column gap="xs" style={{ marginTop: "16px" }}>
          <Text variant="label-default-xs" onBackground="neutral-weak">
            Description
          </Text>
          <Text
            variant="body-default-s"
            style={{
              lineHeight: "1.5",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word"
            }}
          >
            {event.description}
          </Text>
        </Column>
      )}
    </Column>
  );
};

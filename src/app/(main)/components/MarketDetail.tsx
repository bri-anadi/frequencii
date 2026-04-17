import React from "react";
import { Column, Row, Text, Button, Badge } from "@once-ui-system/core";
import type { PredictionEvent } from "@/lib/types";

interface MarketDetailProps {
  event: PredictionEvent;
  onClose: () => void;
  onTrade?: () => void;
  isUnlocked?: boolean;
}

export const MarketDetail: React.FC<MarketDetailProps> = ({
  event,
  onClose,
  onTrade,
  isUnlocked = false,
}) => {
  const market = event.markets[0];
  const yesPrice = market?.outcomePrices?.[0] ?? 0.5;
  const noPrice = market?.outcomePrices?.[1] ?? 0.5;
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = Math.round(noPrice * 100);

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

  return (
    <Column
      fillWidth
      padding="m"
      gap="m"
      border="neutral-alpha-medium"
      radius="l"
      background="neutral-weak"
      style={{ overflow: "hidden" }}
    >
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

      {/* Header */}
      <Row fillWidth vertical="center" style={{ justifyContent: "space-between" }}>
        <Text variant="heading-strong-s" style={{ maxWidth: "85%" }}>
          {event.title}
        </Text>
        <Button variant="tertiary" size="s" onClick={onClose}>
          Close
        </Button>
      </Row>

      {/* Category + time */}
      <Row gap="s" vertical="center">
        {event.category && (
          <Badge title={event.category} arrow={false} paddingX="12" paddingY="4" textSize="xs" />
        )}
        {getDaysLeft(event.endDate) && (
          <Text variant="body-default-xs" onBackground="neutral-weak">
            {getDaysLeft(event.endDate)}
          </Text>
        )}
      </Row>

      {/* Odds display */}
      <Column gap="xs">
        <Row fillWidth gap="s">
          <Column
            flex={1}
            padding="s"
            radius="m"
            center
            style={{
              background: "var(--success-alpha-weak, rgba(34,197,94,0.1))",
              border: "1px solid var(--success-solid-strong)",
            }}
          >
            <Text variant="heading-strong-l" style={{ color: "var(--success-solid-strong)" }}>
              {yesPercent}%
            </Text>
            <Text variant="label-default-s" onBackground="neutral-weak">
              YES
            </Text>
          </Column>

          <Column
            flex={1}
            padding="s"
            radius="m"
            center
            style={{
              background: "var(--danger-alpha-weak, rgba(239,68,68,0.1))",
              border: "1px solid var(--danger-solid-strong, #ef4444)",
            }}
          >
            <Text variant="heading-strong-l" style={{ color: "var(--danger-solid-strong, #ef4444)" }}>
              {noPercent}%
            </Text>
            <Text variant="label-default-s" onBackground="neutral-weak">
              NO
            </Text>
          </Column>
        </Row>

        {/* Odds bar */}
        <Row
          fillWidth
          style={{ height: "8px", borderRadius: "4px", overflow: "hidden" }}
        >
          <div
            style={{
              width: `${yesPercent}%`,
              background: "var(--success-solid-strong)",
              transition: "width 0.3s ease",
            }}
          />
          <div
            style={{
              width: `${noPercent}%`,
              background: "var(--danger-solid-strong, #ef4444)",
              transition: "width 0.3s ease",
            }}
          />
        </Row>
      </Column>

      {/* Stats */}
      <Row fillWidth gap="m" style={{ flexWrap: "wrap" }}>
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
        {market?.oneDayPriceChange !== undefined && market.oneDayPriceChange !== 0 && (
          <Column gap="2">
            <Text variant="body-default-xs" onBackground="neutral-weak">
              24h Change
            </Text>
            <Text
              variant="label-default-s"
              style={{
                color:
                  market.oneDayPriceChange > 0
                    ? "var(--success-solid-strong)"
                    : "var(--danger-solid-strong, #ef4444)",
              }}
            >
              {market.oneDayPriceChange > 0 ? "+" : ""}
              {(market.oneDayPriceChange * 100).toFixed(1)}%
            </Text>
          </Column>
        )}
      </Row>

      {/* Description */}
      {event.description && (
        <Column gap="xs">
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

      {/* Trade button */}
      <Button
        variant="primary"
        fillWidth
        disabled={!isUnlocked}
        onClick={onTrade}
      >
        {isUnlocked ? "Trade Privately" : "Setup Private Wallet to Trade"}
      </Button>
    </Column>
  );
};

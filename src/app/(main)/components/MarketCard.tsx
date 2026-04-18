import React from "react";
import { Column, Row, Text, Button, Badge } from "@once-ui-system/core";
import type { PredictionEvent } from "@/lib/types";

interface MarketCardProps {
  event: PredictionEvent;
  isSelected: boolean;
  onClick: () => void;
}

export const MarketCard: React.FC<MarketCardProps> = ({
  event,
  isSelected,
  onClick,
}) => {
  const sortedMarkets = [...(event.markets || [])].sort((a, b) => {
    const aYes = a.outcomePrices?.[0] ?? 0;
    const bYes = b.outcomePrices?.[0] ?? 0;
    return bYes - aYes; // Highest YES probability first
  });

  const market = sortedMarkets[0];
  const yesPrice = market?.outcomePrices?.[0] ?? 0.5;
  const noPrice = market?.outcomePrices?.[1] ?? 0.5;
  const yesPercent = (yesPrice * 100).toFixed(1);
  const noPercent = (noPrice * 100).toFixed(1);

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
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
      padding="s"
      gap="s"
      radius="l"
      border="neutral-alpha-medium"
      background={isSelected ? "neutral-medium" : "surface"}
      onClick={onClick}
      style={{
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
        minHeight: "fit-content",
      }}
    >
      <Row gap="s" vertical="start" fillWidth>
        {/* Thumbnail Image */}
        {event.image && (
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '8px',
              overflow: 'hidden',
              flexShrink: 0
            }}
          >
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

        <Column gap="xs" flex={1}>
          <Text variant="label-strong-s" style={{ whiteSpace: "normal" }}>
            {event.title}
          </Text>
          <Row gap="xs" vertical="center">
            {event.category && (
              <Text variant="body-default-xs" onBackground="neutral-weak" style={{ textTransform: "capitalize" }}>
                {event.category}
              </Text>
            )}
            <Text variant="body-default-xs" onBackground="neutral-weak">
              •
            </Text>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              {getDaysLeft(event.endDate) || (event.active ? 'Active' : 'Closed')}
            </Text>
            {event.markets.length > 1 && (
              <>
                <Text variant="body-default-xs" onBackground="neutral-weak">
                  •
                </Text>
                <Text variant="body-default-xs" onBackground="neutral-weak">
                  {event.markets.length} Options
                </Text>
              </>
            )}
          </Row>
          {event.description && (
            <Text variant="body-default-xs" onBackground="neutral-weak" style={{
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'normal',
              width: '100%',
              wordBreak: 'break-word',
              marginTop: '2px'
            }}>
              {event.description}
            </Text>
          )}
        </Column>
      </Row>

      {/* Odds bar */}
      {event.markets.length > 1 ? (
        <>
          <Row fillWidth gap="2" style={{ height: "6px", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                width: `${yesPercent}%`,
                backgroundColor: "var(--success-solid-strong)",
                transition: "width 0.3s ease",
              }}
            />
            <div
              style={{
                width: `${100 - yesPercent}%`,
                backgroundColor: "var(--neutral-alpha-weak)",
                transition: "width 0.3s ease",
              }}
            />
          </Row>

          <Row fillWidth vertical="center" style={{ justifyContent: "space-between" }}>
            <Row gap="xs" vertical="center" style={{ overflow: 'hidden' }}>
              <Text
                variant="body-default-xs"
                style={{
                  color: "var(--success-solid-strong)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "200px"
                }}
                title={market?.question}
              >
               Top {yesPercent}c: {market?.question || 'Option'}
              </Text>
            </Row>
            <Text variant="body-default-xs" onBackground="neutral-weak" style={{ flexShrink: 0 }}>
              {formatVolume(event.volume)}
            </Text>
          </Row>
        </>
      ) : (
        <>
          <Row fillWidth gap="2" style={{ height: "6px", borderRadius: "3px", overflow: "hidden" }}>
            <div
              style={{
                width: `${yesPercent}%`,
                backgroundColor: "var(--success-solid-strong)",
                transition: "width 0.3s ease",
              }}
            />
            <div
              style={{
                width: `${noPercent}%`,
                backgroundColor: "var(--danger-solid-strong, #ef4444)",
                transition: "width 0.3s ease",
              }}
            />
          </Row>

          <Row fillWidth vertical="center" style={{ justifyContent: "space-between" }}>
            <Row gap="xs">
              <Text
                variant="body-default-xs"
                style={{ color: "var(--success-solid-strong)" }}
              >
                Yes {yesPercent}c
              </Text>
              <Text variant="body-default-xs" onBackground="neutral-weak">
                /
              </Text>
              <Text
                variant="body-default-xs"
                style={{ color: "var(--danger-solid-strong, #ef4444)" }}
              >
                No {noPercent}c
              </Text>
            </Row>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              {formatVolume(event.volume)}
            </Text>
          </Row>
        </>
      )}
    </Column>
  );
};

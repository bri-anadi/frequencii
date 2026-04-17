import React from "react";
import { Column, Row, Text, Button } from "@once-ui-system/core";
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
  const market = event.markets[0];
  const yesPrice = market?.outcomePrices?.[0] ?? 0.5;
  const noPrice = market?.outcomePrices?.[1] ?? 0.5;
  const yesPercent = Math.round(yesPrice * 100);
  const noPercent = Math.round(noPrice * 100);

  const formatVolume = (vol: number) => {
    if (vol >= 1_000_000) return `$${(vol / 1_000_000).toFixed(1)}M`;
    if (vol >= 1_000) return `$${(vol / 1_000).toFixed(1)}K`;
    return `$${vol.toFixed(0)}`;
  };

  return (
    <Column
      fillWidth
      padding="s"
      gap="s"
      radius="l"
      border="neutral-alpha-medium"
      background={isSelected ? "neutral-medium" : "neutral-weak"}
      onClick={onClick}
      style={{
        cursor: "pointer",
        transition: "all 0.2s ease-in-out",
        minHeight: "fit-content",
      }}
    >
      <Text variant="label-default-s" style={{ whiteSpace: "normal" }}>
        {event.title}
      </Text>

      {/* Odds bar */}
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
            Yes {yesPercent}%
          </Text>
          <Text variant="body-default-xs" onBackground="neutral-weak">
            /
          </Text>
          <Text
            variant="body-default-xs"
            style={{ color: "var(--danger-solid-strong, #ef4444)" }}
          >
            No {noPercent}%
          </Text>
        </Row>
        <Text variant="body-default-xs" onBackground="neutral-weak">
          {formatVolume(event.volume)}
        </Text>
      </Row>
    </Column>
  );
};

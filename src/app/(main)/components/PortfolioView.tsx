import React, { useEffect } from "react";
import { Column, Row, Text, Button } from "@once-ui-system/core";
import type { Position } from "@/lib/types";

interface PortfolioViewProps {
  positions: Position[];
  isLoading: boolean;
  isTrading: boolean;
  onRefresh: () => void;
  onClaim: (positionId: string) => Promise<any>;
}

export const PortfolioView: React.FC<PortfolioViewProps> = ({
  positions,
  isLoading,
  isTrading,
  onRefresh,
  onClaim,
}) => {
  // Auto-fetch on mount
  useEffect(() => {
    onRefresh();
  }, []);

  const totalPnl = positions.reduce((sum, p) => sum + p.pnl, 0);
  const activePositions = positions.filter((p) => !p.resolved);
  const resolvedPositions = positions.filter((p) => p.resolved);

  if (positions.length === 0 && !isLoading) {
    return (
      <Column
        fillWidth
        padding="m"
        gap="s"
        border="neutral-alpha-medium"
        radius="l"
        background="neutral-weak"
      >
        <Text variant="heading-strong-s">Portfolio</Text>
        <Text variant="body-default-s" onBackground="neutral-weak">
          No positions yet. Place your first private prediction trade.
        </Text>
      </Column>
    );
  }

  return (
    <Column
      fillWidth
      padding="m"
      gap="m"
      border="neutral-alpha-medium"
      radius="l"
      background="neutral-weak"
    >
      {/* Header */}
      <Row fillWidth vertical="center" style={{ justifyContent: "space-between" }}>
        <Text variant="heading-strong-s">Portfolio</Text>
        <Button
          variant="tertiary"
          size="s"
          onClick={onRefresh}
          loading={isLoading}
        >
          Refresh
        </Button>
      </Row>

      {/* Summary */}
      <Row fillWidth gap="m">
        <Column
          padding="s"
          radius="m"
          flex={1}
          style={{ background: "var(--neutral-alpha-weak)" }}
        >
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Active Positions
          </Text>
          <Text variant="heading-strong-m">{activePositions.length}</Text>
        </Column>
        <Column
          padding="s"
          radius="m"
          flex={1}
          style={{ background: "var(--neutral-alpha-weak)" }}
        >
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Total P&L
          </Text>
          <Text
            variant="heading-strong-m"
            style={{
              color:
                totalPnl >= 0
                  ? "var(--success-solid-strong)"
                  : "var(--danger-solid-strong, #ef4444)",
            }}
          >
            {totalPnl >= 0 ? "+" : ""}
            {totalPnl.toFixed(4)} SOL
          </Text>
        </Column>
      </Row>

      {isLoading && (
        <Text variant="body-default-s" onBackground="neutral-weak">
          Loading positions...
        </Text>
      )}

      {/* Active positions */}
      {activePositions.length > 0 && (
        <Column gap="xs">
          <Text variant="label-default-xs" onBackground="neutral-weak">
            Active
          </Text>
          {activePositions.map((pos, i) => (
            <PositionRow key={`active-${i}`} position={pos} />
          ))}
        </Column>
      )}

      {/* Resolved positions */}
      {resolvedPositions.length > 0 && (
        <Column gap="xs">
          <Text variant="label-default-xs" onBackground="neutral-weak">
            Resolved
          </Text>
          {resolvedPositions.map((pos, i) => (
            <Row
              key={`resolved-${i}`}
              fillWidth
              padding="xs"
              gap="s"
              vertical="center"
              radius="m"
              style={{
                background: "var(--neutral-alpha-weak)",
                justifyContent: "space-between",
              }}
            >
              <Column flex={1} gap="2">
                <Text variant="label-default-xs">
                  {pos.marketTitle.slice(0, 40)}
                  {pos.marketTitle.length > 40 ? "..." : ""}
                </Text>
                <Text variant="body-default-xs" onBackground="neutral-weak">
                  {pos.outcome} @ {(pos.entryPrice * 100).toFixed(0)}%
                </Text>
              </Column>
              {pos.claimable && (
                <Button
                  variant="primary"
                  size="s"
                  onClick={() => onClaim(pos.marketId)}
                  disabled={isTrading}
                >
                  Claim
                </Button>
              )}
            </Row>
          ))}
        </Column>
      )}
    </Column>
  );
};

function PositionRow({ position }: { position: Position }) {
  const pnlColor =
    position.pnl >= 0
      ? "var(--success-solid-strong)"
      : "var(--danger-solid-strong, #ef4444)";

  return (
    <Row
      fillWidth
      padding="xs"
      gap="s"
      vertical="center"
      radius="m"
      style={{
        background: "var(--neutral-alpha-weak)",
        justifyContent: "space-between",
      }}
    >
      <Column flex={1} gap="2">
        <Text variant="label-default-xs">
          {position.marketTitle.slice(0, 40)}
          {position.marketTitle.length > 40 ? "..." : ""}
        </Text>
        <Row gap="xs">
          <Text
            variant="body-default-xs"
            style={{
              color:
                position.outcome === "YES"
                  ? "var(--success-solid-strong)"
                  : "var(--danger-solid-strong, #ef4444)",
            }}
          >
            {position.outcome}
          </Text>
          <Text variant="body-default-xs" onBackground="neutral-weak">
            @ {(position.entryPrice * 100).toFixed(0)}% &gt;{" "}
            {(position.currentPrice * 100).toFixed(0)}%
          </Text>
        </Row>
      </Column>
      <Column style={{ textAlign: "right" }} gap="2">
        <Text variant="label-default-xs">{position.amount.toFixed(4)} SOL</Text>
        <Text variant="body-default-xs" style={{ color: pnlColor }}>
          {position.pnl >= 0 ? "+" : ""}
          {position.pnl.toFixed(4)} ({position.pnlPercent.toFixed(1)}%)
        </Text>
      </Column>
    </Row>
  );
}

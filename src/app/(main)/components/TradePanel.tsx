import React, { useState } from "react";
import { Column, Row, Text, Button, Input } from "@once-ui-system/core";
import type { PredictionEvent, TradeOutcome, TradeStep } from "@/lib/types";

interface TradePanelProps {
  event: PredictionEvent;
  burnerBalanceSol: number;
  isUnlocked: boolean;
  tradeStep: TradeStep;
  tradeMessage: string;
  tradeError: string | null;
  isTrading: boolean;
  onTrade: (marketId: string, outcome: TradeOutcome, amount: number) => Promise<any>;
  onReset: () => void;
  onClose: () => void;
}

const STEP_LABELS: Record<TradeStep, string> = {
  idle: "",
  building: "Building TX",
  signing: "Signing",
  submitting: "Submitting",
  confirming: "Confirming",
  complete: "Done",
  failed: "Failed",
};

export const TradePanel: React.FC<TradePanelProps> = ({
  event,
  burnerBalanceSol,
  isUnlocked,
  tradeStep,
  tradeMessage,
  tradeError,
  isTrading,
  onTrade,
  onReset,
  onClose,
}) => {
  const [selectedOutcome, setSelectedOutcome] = useState<TradeOutcome>("YES");
  const [amount, setAmount] = useState("0.1");

  const market = event.markets[0];
  const yesPrice = market?.outcomePrices?.[0] ?? 0.5;
  const noPrice = market?.outcomePrices?.[1] ?? 0.5;

  const selectedPrice =
    selectedOutcome === "YES" ? yesPrice : noPrice;
  const potentialPayout =
    parseFloat(amount || "0") / selectedPrice;
  const potentialProfit = potentialPayout - parseFloat(amount || "0");

  const handleTrade = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) return;
    if (!market?.id) return;

    try {
      await onTrade(market.id, selectedOutcome, amt);
    } catch {
      // Error handled in hook
    }
  };

  if (!isUnlocked) {
    return (
      <Column
        fillWidth
        padding="m"
        gap="s"
        border="neutral-alpha-medium"
        radius="l"
        background="neutral-weak"
      >
        <Text variant="body-default-s" onBackground="neutral-weak">
          Unlock your private wallet to trade.
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
      <Row fillWidth vertical="center" style={{ justifyContent: "space-between" }}>
        <Text variant="heading-strong-s">Trade Privately</Text>
        <Button variant="tertiary" size="s" onClick={onClose}>
          Close
        </Button>
      </Row>

      <Text variant="body-default-xs" onBackground="neutral-weak">
        {event.title}
      </Text>

      {/* Outcome selector */}
      <Row fillWidth gap="s">
        <Button
          variant={selectedOutcome === "YES" ? "primary" : "tertiary"}
          onClick={() => setSelectedOutcome("YES")}
          style={{
            flex: 1,
            ...(selectedOutcome === "YES"
              ? {}
              : {}),
          }}
          disabled={isTrading}
        >
          YES ({Math.round(yesPrice * 100)}%)
        </Button>
        <Button
          variant={selectedOutcome === "NO" ? "primary" : "tertiary"}
          onClick={() => setSelectedOutcome("NO")}
          style={{
            flex: 1,
            ...(selectedOutcome === "NO"
              ? {
                background: "var(--danger-solid-strong, #ef4444)",
              }
              : {}),
          }}
          disabled={isTrading}
        >
          NO ({Math.round(noPrice * 100)}%)
        </Button>
      </Row>

      {/* Amount input */}
      <Column gap="xs">
        <Row fillWidth style={{ justifyContent: "space-between" }}>
          <Text variant="label-default-xs">Amount (SOL)</Text>
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Balance: {burnerBalanceSol.toFixed(4)} SOL
          </Text>
        </Row>
        <Input
          id="trade-amount"
          type="number"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          height="s"
          min="0.01"
          step="0.01"
          disabled={isTrading}
        />
      </Column>

      {/* Potential payout calculation */}
      {parseFloat(amount) > 0 && (
        <Column
          padding="s"
          radius="m"
          gap="xs"
          style={{ background: "var(--brand-alpha-weak)" }}
        >
          <Row fillWidth style={{ justifyContent: "space-between" }}>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              Implied probability
            </Text>
            <Text variant="label-default-xs">
              {Math.round(selectedPrice * 100)}%
            </Text>
          </Row>
          <Row fillWidth style={{ justifyContent: "space-between" }}>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              Potential payout
            </Text>
            <Text variant="label-default-xs">
              {potentialPayout.toFixed(4)} SOL
            </Text>
          </Row>
          <Row fillWidth style={{ justifyContent: "space-between" }}>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              Potential profit
            </Text>
            <Text
              variant="label-default-xs"
              style={{ color: "var(--success-solid-strong)" }}
            >
              +{potentialProfit.toFixed(4)} SOL
            </Text>
          </Row>
        </Column>
      )}

      {/* Trade progress */}
      {tradeStep !== "idle" && (
        <Column gap="xs">
          <Row gap="xs" vertical="center">
            {tradeStep !== "complete" && tradeStep !== "failed" && (
              <div
                style={{
                  width: 12,
                  height: 12,
                  borderRadius: "50%",
                  border: "2px solid var(--brand-solid-strong)",
                  borderTopColor: "transparent",
                  animation: "spin 1s linear infinite",
                }}
              />
            )}
            <Text
              variant="body-default-xs"
              style={{
                color:
                  tradeStep === "failed"
                    ? "var(--danger-solid-strong, #ef4444)"
                    : tradeStep === "complete"
                      ? "var(--success-solid-strong)"
                      : "var(--neutral-on-surface-weak)",
              }}
            >
              {STEP_LABELS[tradeStep]}: {tradeMessage}
            </Text>
          </Row>
          {(tradeStep === "complete" || tradeStep === "failed") && (
            <Button variant="tertiary" size="s" onClick={onReset}>
              {tradeStep === "failed" ? "Try Again" : "New Trade"}
            </Button>
          )}
        </Column>
      )}

      {tradeError && (
        <Text
          variant="body-default-xs"
          style={{ color: "var(--danger-solid-strong, #ef4444)" }}
        >
          {tradeError}
        </Text>
      )}

      {/* Execute button */}
      {tradeStep === "idle" && (
        <Button
          variant="primary"
          fillWidth
          onClick={handleTrade}
          loading={isTrading}
          disabled={
            isTrading ||
            !amount ||
            parseFloat(amount) <= 0 ||
            parseFloat(amount) > burnerBalanceSol
          }
        >
          {parseFloat(amount) > burnerBalanceSol
            ? "Insufficient Private Balance"
            : `Trade ${selectedOutcome} with Private Wallet`}
        </Button>
      )}

      <Text variant="body-default-xs" onBackground="neutral-weak" style={{ fontSize: "10px" }}>
        This trade will be signed by your private wallet. Your main wallet identity is not linked to this position.
      </Text>

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </Column>
  );
};

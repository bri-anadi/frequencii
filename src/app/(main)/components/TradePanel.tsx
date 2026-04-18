import React, { useState } from "react";
import { Column, Row, Text, Button, Input, IconButton } from "@once-ui-system/core";
import type { PredictionEvent, PredictionMarket, TradeOutcome, TradeStep } from "@/lib/types";

interface TradePanelProps {
  event: PredictionEvent;
  market: PredictionMarket;
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
  market,
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
        <IconButton
          variant="secondary"
          icon="close"
          size="m"
          onClick={onClose}
          tooltip="Close"
        />
      </Row>

      {market.question !== event.title ? (
        <Column gap="4">
          <Text variant="body-default-xs" onBackground="neutral-weak">
            {event.title}
          </Text>
          <Text variant="body-strong-s">
            {market.question}
          </Text>
        </Column>
      ) : (
        <Text variant="body-default-xs" onBackground="neutral-weak">
          {event.title}
        </Text>
      )}

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
          YES ({(yesPrice * 100).toFixed(1)}c)
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
          NO ({(noPrice * 100).toFixed(1)}c)
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
        <Row
          fillWidth
          gap="xs"
          padding="xs"
          border="neutral-alpha-medium"
          radius="l"
          background="neutral-weak"
          vertical="center"
        >
          <Input
            id="trade-amount"
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            height="s"
            min="0.01"
            step="0.01"
            style={{ flex: 1 }}
            disabled={isTrading}
            placeholder="0.1"
          />
          {tradeStep === "idle" && (
            <Button
              variant="primary"
              size="s"
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
                ? "Insufficient Drip"
                : `Trade ${selectedOutcome}`}
            </Button>
          )}
        </Row>
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
              {(selectedPrice * 100).toFixed(1)}c
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

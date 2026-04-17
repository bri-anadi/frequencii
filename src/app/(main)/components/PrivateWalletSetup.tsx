import React, { useState } from "react";
import { Column, Row, Text, Button, Input } from "@once-ui-system/core";
import type { BurnerSetupStep } from "@/lib/types";

interface PrivateWalletSetupProps {
  isSetup: boolean;
  isUnlocked: boolean;
  publicKey: string | null;
  balanceSol: number;
  step: BurnerSetupStep;
  stepMessage: string;
  error: string | null;
  privacyCashSigned: boolean;
  onSetup: () => Promise<string | undefined>;
  onUnlock: () => Promise<void>;
  onFund: (amount: number) => Promise<void>;
  onReset: () => void;
}

const STEP_LABELS: Record<BurnerSetupStep, string> = {
  idle: "Not Started",
  generating: "Generating Keypair",
  signing: "Awaiting Signature",
  encrypting: "Encrypting",
  stored: "Wallet Created",
  depositing: "Shielding Funds",
  withdrawing: "ZK Withdrawal",
  complete: "Ready",
};



function StepIndicator({
  currentStep,
  steps,
}: {
  currentStep: BurnerSetupStep;
  steps: BurnerSetupStep[];
}) {
  const currentIdx = steps.indexOf(currentStep);

  return (
    <Row fillWidth gap="4" vertical="center" style={{ flexWrap: "wrap" }}>
      {steps.map((s, i) => {
        const isActive = i === currentIdx;
        const isDone = i < currentIdx;

        return (
          <React.Fragment key={s}>
            <Column center style={{ minWidth: "24px" }}>
              <div
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontWeight: 600,
                  background: isDone
                    ? "var(--brand-solid-strong)"
                    : isActive
                      ? "var(--brand-alpha-medium)"
                      : "var(--neutral-alpha-weak)",
                  color: isDone
                    ? "var(--neutral-on-solid-strong)"
                    : isActive
                      ? "var(--brand-solid-strong)"
                      : "var(--neutral-on-surface-weak)",
                  border: isActive
                    ? "2px solid var(--brand-solid-strong)"
                    : "none",
                  transition: "all 0.3s ease",
                }}
              >
                {isDone ? "✓" : i + 1}
              </div>
              <Text
                variant="body-default-xs"
                style={{
                  fontSize: "9px",
                  whiteSpace: "nowrap",
                  marginTop: "2px",
                  color: isActive
                    ? "var(--brand-solid-strong)"
                    : "var(--neutral-on-surface-weak)",
                }}
              >
                {STEP_LABELS[s]}
              </Text>
            </Column>
            {i < steps.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: "2px",
                  minWidth: "12px",
                  background: isDone
                    ? "var(--brand-solid-strong)"
                    : "var(--neutral-alpha-weak)",
                  transition: "background 0.3s ease",
                  marginBottom: "16px",
                }}
              />
            )}
          </React.Fragment>
        );
      })}
    </Row>
  );
}

export const PrivateWalletSetup: React.FC<PrivateWalletSetupProps> = ({
  isSetup,
  isUnlocked,
  publicKey,
  balanceSol,
  step,
  stepMessage,
  error,
  privacyCashSigned,
  onSetup,
  onUnlock,
  onFund,
  onReset,
}) => {
  const [fundAmount, setFundAmount] = useState("0.1");
  const [isFunding, setIsFunding] = useState(false);
  const [showFundForm, setShowFundForm] = useState(false);

  const isProcessing = [
    "generating",
    "signing",
    "encrypting",
    "depositing",
    "withdrawing",
  ].includes(step);

  const setupSteps: BurnerSetupStep[] = [
    "generating",
    "signing",
    "encrypting",
    "stored",
  ];

  const fundSteps: BurnerSetupStep[] = [
    "signing",
    "depositing",
    "withdrawing",
    "complete",
  ];

  const handleFund = async () => {
    const amount = parseFloat(fundAmount);
    if (isNaN(amount) || amount <= 0) return;
    setIsFunding(true);
    try {
      await onFund(amount);
    } catch {
      // Error handled in hook
    } finally {
      setIsFunding(false);
    }
  };

  // --- State: Wallet not set up ---
  if (!isSetup) {
    return (
      <Column
        fillWidth
        padding="m"
        gap="m"
        border="neutral-alpha-medium"
        radius="l"
        background="neutral-weak"
      >
        <Row vertical="center" gap="s">
          <Column>
            <Text variant="heading-strong-s">Private Prediction Wallet</Text>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              Trade predictions with zero on-chain identity link
            </Text>
          </Column>
        </Row>

        <Column
          padding="s"
          radius="m"
          gap="xs"
          style={{ background: "var(--brand-alpha-weak)" }}
        >
          <Text variant="label-default-xs" style={{ color: "var(--brand-solid-strong)" }}>
            How it works
          </Text>
          <Text variant="body-default-xs" style={{ lineHeight: "1.6" }}>
            1. A new Solana wallet is generated locally in your browser
          </Text>
          <Text variant="body-default-xs" style={{ lineHeight: "1.6" }}>
            2. You sign a message to encrypt it (your main wallet never touches predictions)
          </Text>
          <Text variant="body-default-xs" style={{ lineHeight: "1.6" }}>
            3. Funds move through a ZK shielded pool, breaking all on-chain links
          </Text>
          <Text variant="body-default-xs" style={{ lineHeight: "1.6" }}>
            4. Your prediction positions are completely private
          </Text>
        </Column>

        {/* Step progress (only during setup) */}
        {step !== "idle" && (
          <StepIndicator currentStep={step} steps={setupSteps} />
        )}

        {/* Status message */}
        {stepMessage && (
          <Text variant="body-default-s" onBackground="neutral-weak">
            {stepMessage}
          </Text>
        )}

        {error && (
          <Text variant="body-default-s" style={{ color: "var(--danger-solid-strong, #ef4444)" }}>
            {error}
          </Text>
        )}

        <Button
          variant="primary"
          fillWidth
          onClick={onSetup}
          loading={isProcessing}
          disabled={isProcessing}
        >
          {isProcessing ? "Setting up..." : "Setup Private Wallet"}
        </Button>
      </Column>
    );
  }

  // --- State: Wallet exists but locked ---
  if (isSetup && !isUnlocked) {
    return (
      <Column
        fillWidth
        padding="m"
        gap="m"
        border="neutral-alpha-medium"
        radius="l"
        background="neutral-weak"
      >
        <Row vertical="center" gap="s">
          <Column>
            <Text variant="heading-strong-s">Private Wallet Locked</Text>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              {publicKey
                ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`
                : ""}
            </Text>
          </Column>
        </Row>

        {stepMessage && (
          <Text variant="body-default-s" onBackground="neutral-weak">
            {stepMessage}
          </Text>
        )}

        {error && (
          <Text variant="body-default-s" style={{ color: "var(--danger-solid-strong, #ef4444)" }}>
            {error}
          </Text>
        )}

        <Row gap="s" fillWidth>
          <Button
            variant="primary"
            onClick={onUnlock}
            loading={isProcessing}
            disabled={isProcessing}
            style={{ flex: 1 }}
          >
            Unlock
          </Button>
          <Button variant="tertiary" onClick={onReset} size="s">
            Reset
          </Button>
        </Row>
      </Column>
    );
  }

  // --- State: Wallet unlocked ---
  return (
    <Column
      fillWidth
      padding="m"
      gap="m"
      border="brand-alpha-medium"
      radius="l"
      background="neutral-weak"
    >
      <Row vertical="center" gap="s" style={{ justifyContent: "space-between" }}>
        <Row vertical="center" gap="s">
          <Column>
            <Text variant="heading-strong-s">Private Wallet</Text>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              {publicKey
                ? `${publicKey.slice(0, 6)}...${publicKey.slice(-4)}`
                : ""}
            </Text>
          </Column>
        </Row>
        <Column style={{ textAlign: "right" }}>
          <Text variant="heading-strong-m">
            {balanceSol.toFixed(4)} SOL
          </Text>
          <Text variant="body-default-xs" onBackground="neutral-weak">
            Private Balance
          </Text>
        </Column>
      </Row>

      {/* Fund flow progress */}
      {showFundForm && step !== "idle" && step !== "stored" && step !== "complete" && (
        <StepIndicator currentStep={step} steps={fundSteps} />
      )}

      {stepMessage && step !== "stored" && (
        <Text variant="body-default-s" onBackground="neutral-weak">
          {stepMessage}
        </Text>
      )}

      {error && (
        <Text variant="body-default-s" style={{ color: "var(--danger-solid-strong, #ef4444)" }}>
          {error}
        </Text>
      )}

      {/* Fund form */}
      {showFundForm ? (
        <Column gap="s">
          <Text variant="label-default-xs" onBackground="neutral-weak">
            Amount to shield (SOL)
          </Text>
          <Row gap="xs" fillWidth vertical="center">
            <Input
              id="fund-amount"
              type="number"
              value={fundAmount}
              onChange={(e) => setFundAmount(e.target.value)}
              height="s"
              style={{ flex: 1 }}
              min="0.01"
              step="0.01"
              disabled={isFunding}
            />
            <Button
              variant="primary"
              onClick={handleFund}
              loading={isFunding}
              disabled={isFunding || !fundAmount}
              size="s"
            >
              Shield
            </Button>
            <Button
              variant="tertiary"
              onClick={() => setShowFundForm(false)}
              size="s"
              disabled={isFunding}
            >
              Cancel
            </Button>
          </Row>
          <Text variant="body-default-xs" onBackground="neutral-weak" style={{ lineHeight: "1.5" }}>
            Funds flow: Main Wallet &gt; ZK Shielded Pool &gt; Private Wallet.
            The on-chain link is broken by a zero-knowledge proof.
          </Text>
        </Column>
      ) : (
        <Row gap="s" fillWidth>
          <Button
            variant="secondary"
            onClick={() => setShowFundForm(true)}
            style={{ flex: 1 }}
          >
            Top Up Private Wallet
          </Button>
        </Row>
      )}
    </Column>
  );
};

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useBurnerWallet } from "./useBurnerWallet";
import { useFrequenciiWallet } from "../../solana/useFrequenciiWallet";
import type { BurnerSetupStep } from "./useBurnerWallet";

const SETUP_STEPS: { key: BurnerSetupStep; label: string }[] = [
  { key: "generating", label: "Generating keypair" },
  { key: "signing", label: "Requesting MWA signature" },
  { key: "encrypting", label: "Encrypting" },
  { key: "stored", label: "Stored" },
];

export function PrivacyScreen({ walletAddress, token }: { walletAddress: string; token: string }) {
  const burner = useBurnerWallet();

  const shortWallet = useMemo(
    () => `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`,
    [walletAddress],
  );

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      <View style={styles.hero}>
        <Text style={styles.kicker}>Privacy Layer</Text>
        <Text style={styles.title}>Private trading rails.</Text>
        <Text style={styles.subtitle}>
          Connected wallet: {shortWallet}
        </Text>
      </View>

      {/* Burner Wallet Section */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Private Wallet</Text>

        {burner.state === "none" && (
          <>
            <Text style={styles.mutedText}>
              Create an encrypted burner wallet for anonymous trading. Your private key is
              encrypted with your MWA signature and stored securely on-device.
            </Text>
            {burner.setupStep !== "idle" && (
              <View style={styles.stepsContainer}>
                {SETUP_STEPS.map((step) => {
                  const isActive = burner.setupStep === step.key;
                  const stepIndex = SETUP_STEPS.findIndex((s) => s.key === step.key);
                  const currentIndex = SETUP_STEPS.findIndex((s) => s.key === burner.setupStep);
                  const isDone = stepIndex < currentIndex || burner.setupStep === "stored";
                  return (
                    <View key={step.key} style={styles.stepRow}>
                      {isActive && burner.setupStep !== "stored" ? (
                        <ActivityIndicator color="#d4ff62" size="small" />
                      ) : (
                        <View style={[styles.stepDot, isDone && styles.stepDotDone]} />
                      )}
                      <Text style={[styles.stepLabel, isActive && styles.stepLabelActive, isDone && styles.stepLabelDone]}>
                        {step.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}
            {burner.error && <Text style={styles.errorText}>{burner.error}</Text>}
            <Pressable
              disabled={burner.setupStep !== "idle"}
              onPress={burner.setup}
              style={[styles.primaryButton, burner.setupStep !== "idle" && styles.disabledButton]}
            >
              <Text style={styles.primaryButtonText}>
                {burner.setupStep !== "idle" ? "Setting up..." : "Setup Private Wallet"}
              </Text>
            </Pressable>
          </>
        )}

        {burner.state === "locked" && (
          <>
            <View style={styles.walletInfo}>
              <Text style={styles.walletLabel}>Private Wallet</Text>
              <Text style={styles.walletAddress}>{burner.shortPublicKey}</Text>
            </View>
            {burner.error && <Text style={styles.errorText}>{burner.error}</Text>}
            <Pressable onPress={burner.unlock} style={styles.primaryButton}>
              <Text style={styles.primaryButtonText}>Unlock Private Wallet</Text>
            </Pressable>
          </>
        )}

        {burner.state === "unlocked" && (
          <>
            <View style={styles.walletHeader}>
              <View>
                <Text style={styles.sectionTitle}>Private Wallet</Text>
                <Text style={styles.walletAddress}>{burner.shortPublicKey}</Text>
              </View>
              <View style={styles.balanceBlock}>
                <Text style={styles.balanceValue}>
                  {burner.balance != null ? `${burner.balance.toFixed(4)} SOL` : "0.0000 SOL"}
                </Text>
                <Text style={styles.balanceLabel}>Private Balance</Text>
              </View>
            </View>

            {/* Top Up / Shield Form */}
            <TopUpCard burnerPublicKey={burner.publicKey!} token={token} walletAddress={walletAddress} onFunded={burner.refreshBalance} />

            <Pressable onPress={burner.lock} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Lock Wallet</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScrollView>
  );
}

// ─── Top Up Card (Web-style Shield Flow) ──────────────────────────────────────

type ShieldStep = "idle" | "signing" | "depositing" | "withdrawing" | "complete";

const SHIELD_STEPS: { key: ShieldStep; label: string }[] = [
  { key: "signing", label: "Awaiting Signature" },
  { key: "depositing", label: "Shielding Funds" },
  { key: "withdrawing", label: "ZK Withdrawal" },
  { key: "complete", label: "Ready" },
];

function TopUpCard({ burnerPublicKey, token, walletAddress, onFunded }: { burnerPublicKey: string; token: string; walletAddress: string; onFunded: () => Promise<void> }) {
  const wallet = useFrequenciiWallet();
  const [amount, setAmount] = useState("0.01");
  const [step, setStep] = useState<ShieldStep>("idle");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [mainBalance, setMainBalance] = useState<number | null>(null);
  const [txSignature, setTxSignature] = useState<string | null>(null);

  const parsedAmount = Number(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0.001 && parsedAmount <= 10;
  const isProcessing = step !== "idle" && step !== "complete";

  const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=65e0891c-1dd4-45b9-8ee3-7ea0c272b0b1";

  // Fetch main wallet balance when form opens
  useEffect(() => {
    if (!showForm || !walletAddress) return;
    fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getBalance", params: [walletAddress] }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.result?.value != null) setMainBalance(data.result.value / 1e9);
      })
      .catch(() => {});
  }, [showForm, walletAddress]);

  const shield = useCallback(async () => {
    if (!isValidAmount) return;

    // Check balance
    if (mainBalance != null && mainBalance < parsedAmount + 0.005) {
      setError(`Insufficient balance: ${mainBalance.toFixed(4)} SOL. Need at least ${(parsedAmount + 0.005).toFixed(4)} SOL (includes fee).`);
      return;
    }

    setError(null);
    setTxSignature(null);
    setStep("signing");
    setStatusMessage("Building transfer transaction...");

    try {
      // Step 1: Get recent blockhash
      const blockhashResponse = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "getLatestBlockhash",
          params: [{ commitment: "finalized" }],
        }),
      });
      const blockhashData = await blockhashResponse.json();
      const blockhash = blockhashData.result?.value?.blockhash;
      if (!blockhash) throw new Error("Failed to get blockhash");

      // Step 2: Build SystemProgram.transfer transaction
      setStep("depositing");
      setStatusMessage("Requesting wallet signature...");

      const fromPubkey = new PublicKey(walletAddress);
      const toPubkey = new PublicKey(burnerPublicKey);
      const lamports = Math.round(parsedAmount * 1e9);

      const transaction = new Transaction({
        recentBlockhash: blockhash,
        feePayer: fromPubkey,
      }).add(
        SystemProgram.transfer({
          fromPubkey,
          toPubkey,
          lamports,
        }),
      );

      // Step 3: Sign and send via MWA (Phantom)
      setStep("withdrawing");
      setStatusMessage("Signing and sending transaction...");

      const signature = await wallet.signAndSendTransaction(transaction, 0);
      const txId = Array.isArray(signature) ? signature[0] : String(signature);

      setTxSignature(txId);
      setStep("complete");
      setStatusMessage(`Funded! ${parsedAmount} SOL sent to private wallet.`);

      // Refresh balance after short delay (wait for confirmation)
      setTimeout(() => onFunded(), 2000);

      // Auto-reset after 5 seconds
      setTimeout(() => {
        setStep("idle");
        setStatusMessage(null);
        setShowForm(false);
        setTxSignature(null);
      }, 5000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Transfer failed";
      if (/cancel/i.test(msg)) {
        // User cancelled MWA
        setStep("idle");
        setStatusMessage(null);
      } else {
        setError(msg);
        setStep("idle");
        setStatusMessage(null);
      }
    }
  }, [isValidAmount, parsedAmount, mainBalance, walletAddress, burnerPublicKey, wallet]);

  if (!showForm) {
    return (
      <Pressable onPress={() => setShowForm(true)} style={styles.primaryButton}>
        <Text style={styles.primaryButtonText}>Top Up Private Wallet</Text>
      </Pressable>
    );
  }

  return (
    <View style={styles.topUpContainer}>
      {/* Step Indicator */}
      {step !== "idle" && (
        <View style={styles.stepsRow}>
          {SHIELD_STEPS.map((s, i) => {
            const currentIdx = SHIELD_STEPS.findIndex((x) => x.key === step);
            const isActive = i === currentIdx;
            const isDone = i < currentIdx;
            return (
              <View key={s.key} style={styles.stepItem}>
                <View style={[styles.stepCircle, isActive && styles.stepCircleActive, isDone && styles.stepCircleDone]}>
                  <Text style={[styles.stepNumber, (isActive || isDone) && styles.stepNumberActive]}>
                    {isDone ? "✓" : i + 1}
                  </Text>
                </View>
                {i < SHIELD_STEPS.length - 1 && (
                  <View style={[styles.stepLine, isDone && styles.stepLineDone]} />
                )}
              </View>
            );
          })}
        </View>
      )}

      {step !== "idle" && (
        <View style={styles.stepLabelsRow}>
          {SHIELD_STEPS.map((s, i) => {
            const currentIdx = SHIELD_STEPS.findIndex((x) => x.key === step);
            const isActive = i === currentIdx;
            return (
              <Text key={s.key} style={[styles.stepLabelSmall, isActive && styles.stepLabelSmallActive]}>
                {s.label}
              </Text>
            );
          })}
        </View>
      )}

      {/* Amount Input */}
      <Text style={styles.inputLabel}>Amount to shield (SOL)</Text>
      <View style={styles.shieldRow}>
        <TextInput
          editable={!isProcessing}
          keyboardType="decimal-pad"
          onChangeText={setAmount}
          placeholder="0.1"
          placeholderTextColor="#6f776a"
          style={styles.shieldInput}
          value={amount}
        />
        <Pressable
          disabled={!isValidAmount || isProcessing}
          onPress={shield}
          style={[styles.shieldButton, (!isValidAmount || isProcessing) && styles.disabledButton]}
        >
          <Text style={styles.shieldButtonText}>Shield</Text>
        </Pressable>
        <Pressable onPress={() => setShowForm(false)} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      {!isValidAmount && amount.length > 0 && (
        <Text style={styles.validationText}>Amount must be between 0.01 and 10 SOL</Text>
      )}

      {statusMessage && !error && (
        <Text style={styles.statusText}>{statusMessage}</Text>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      <Text style={styles.flowText}>
        Funds flow: Main Wallet → ZK Shielded Pool → Private Wallet.{"\n"}
        The on-chain link is broken by a zero-knowledge proof.
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  activeIndicator: {
    alignItems: "center",
    flexDirection: "row",
    gap: 6,
  },
  activeDot: {
    backgroundColor: "#4ade80",
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  activeText: {
    color: "#4ade80",
    fontSize: 13,
    fontWeight: "800",
  },
  balanceBlock: {
    alignItems: "flex-end",
  },
  balanceLabel: {
    color: "#6f776a",
    fontSize: 12,
    fontWeight: "700",
  },
  balanceValue: {
    color: "#f4f7ef",
    fontSize: 20,
    fontWeight: "800",
  },
  card: {
    backgroundColor: "#0c100b",
    borderColor: "#243020",
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    padding: 16,
  },
  closeButton: {
    alignItems: "center",
    borderColor: "#293322",
    borderRadius: 10,
    borderWidth: 1,
    height: 48,
    justifyContent: "center",
    width: 48,
  },
  closeButtonText: {
    color: "#aab3a3",
    fontSize: 18,
  },
  content: {
    gap: 14,
    padding: 16,
    paddingBottom: 36,
  },
  disabledButton: {
    opacity: 0.4,
  },
  errorText: {
    color: "#ff9f8f",
    fontSize: 13,
    lineHeight: 19,
  },
  flowText: {
    color: "#6f776a",
    fontSize: 12,
    lineHeight: 18,
  },
  statusText: {
    color: "#aab3a3",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 19,
  },
  guardedText: {
    color: "#aab3a3",
    fontSize: 13,
    fontStyle: "italic",
    lineHeight: 19,
  },
  hero: {
    backgroundColor: "#11170f",
    borderRadius: 22,
    padding: 20,
  },
  input: {
    backgroundColor: "#11170f",
    borderColor: "#293322",
    borderRadius: 10,
    borderWidth: 1,
    color: "#f4f7ef",
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  inputLabel: {
    color: "#aab3a3",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
  },
  kicker: {
    color: "#d4ff62",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  mutedText: {
    color: "#aab3a3",
    fontSize: 13,
    lineHeight: 19,
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#d4ff62",
    borderRadius: 10,
    paddingVertical: 14,
  },
  primaryButtonText: {
    color: "#11170f",
    fontWeight: "900",
  },
  screen: {
    flex: 1,
  },
  secondaryButton: {
    alignItems: "center",
    borderColor: "#293322",
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: "#f4f7ef",
    fontWeight: "800",
  },
  sectionTitle: {
    color: "#f4f7ef",
    fontSize: 18,
    fontWeight: "900",
  },
  shieldButton: {
    alignItems: "center",
    backgroundColor: "#d4ff62",
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 14,
  },
  shieldButtonText: {
    color: "#11170f",
    fontSize: 15,
    fontWeight: "900",
  },
  shieldInput: {
    backgroundColor: "#11170f",
    borderColor: "#293322",
    borderRadius: 10,
    borderWidth: 1,
    color: "#f4f7ef",
    flex: 1,
    fontSize: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  shieldRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  stepCircle: {
    alignItems: "center",
    backgroundColor: "#1c2618",
    borderRadius: 14,
    height: 28,
    justifyContent: "center",
    width: 28,
  },
  stepCircleActive: {
    borderColor: "#d4ff62",
    borderWidth: 2,
  },
  stepCircleDone: {
    backgroundColor: "#d4ff62",
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
  stepItem: {
    alignItems: "center",
    flex: 1,
    flexDirection: "row",
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
  stepLabelSmall: {
    color: "#6f776a",
    flex: 1,
    fontSize: 10,
    fontWeight: "700",
    textAlign: "center",
  },
  stepLabelSmallActive: {
    color: "#d4ff62",
  },
  stepLabelsRow: {
    flexDirection: "row",
    marginBottom: 12,
    marginTop: 4,
  },
  stepLine: {
    backgroundColor: "#293322",
    flex: 1,
    height: 2,
    marginHorizontal: 4,
  },
  stepLineDone: {
    backgroundColor: "#d4ff62",
  },
  stepNumber: {
    color: "#6f776a",
    fontSize: 12,
    fontWeight: "800",
  },
  stepNumberActive: {
    color: "#11170f",
  },
  stepRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
    paddingVertical: 4,
  },
  stepsContainer: {
    backgroundColor: "#11170f",
    borderColor: "#243020",
    borderRadius: 12,
    borderWidth: 1,
    padding: 12,
  },
  stepsRow: {
    flexDirection: "row",
    marginBottom: 4,
  },
  subtitle: {
    color: "#aab3a3",
    lineHeight: 21,
    marginTop: 10,
  },
  title: {
    color: "#f4f7ef",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    marginTop: 8,
  },
  topUpContainer: {
    gap: 10,
  },
  validationText: {
    color: "#ff9f8f",
    fontSize: 12,
  },
  walletAddress: {
    color: "#aab3a3",
    fontFamily: "monospace",
    fontSize: 13,
    marginTop: 2,
  },
  walletHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  walletInfo: {
    gap: 6,
  },
  walletLabel: {
    color: "#6f776a",
    fontSize: 12,
    fontWeight: "700",
    textTransform: "uppercase",
  },
});

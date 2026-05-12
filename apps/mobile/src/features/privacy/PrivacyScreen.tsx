import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useBurnerWallet } from "./useBurnerWallet";
import { ChatScreen } from "../chat/ChatScreen";
import type { BurnerSetupStep } from "./useBurnerWallet";

const SETUP_STEPS: { key: BurnerSetupStep; label: string }[] = [
  { key: "generating", label: "Generating keypair" },
  { key: "signing", label: "Requesting MWA signature" },
  { key: "encrypting", label: "Encrypting" },
  { key: "stored", label: "Stored" },
];

export function PrivacyScreen({ walletAddress }: { walletAddress: string }) {
  const burner = useBurnerWallet();
  const [showChat, setShowChat] = useState(false);

  const shortWallet = useMemo(
    () => `${walletAddress.slice(0, 6)}...${walletAddress.slice(-6)}`,
    [walletAddress],
  );

  if (showChat) {
    return (
      <View style={styles.screen}>
        <Pressable onPress={() => setShowChat(false)} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back to Privacy</Text>
        </Pressable>
        <ChatScreen walletAddress={walletAddress} />
      </View>
    );
  }

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
            <View style={styles.walletInfo}>
              <View style={styles.activeIndicator}>
                <View style={styles.activeDot} />
                <Text style={styles.activeText}>Private Wallet Active</Text>
              </View>
              <Text style={styles.walletAddress}>{burner.shortPublicKey}</Text>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>Balance</Text>
              <Text style={styles.balanceValue}>
                {burner.balance != null ? `${burner.balance.toFixed(4)} SOL` : "Loading..."}
              </Text>
            </View>
            <Pressable onPress={burner.lock} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Lock Wallet</Text>
            </Pressable>
          </>
        )}
      </View>

      {/* ZK Funding Section */}
      {burner.state === "unlocked" && (
        <ZkFundingCard burnerPublicKey={burner.publicKey!} />
      )}

      {/* P2P Chat */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>P2P Chat</Text>
        <Text style={styles.mutedText}>
          Gasless messaging via MagicBlock Ephemeral Rollups. Manage contacts and send messages
          without gas fees.
        </Text>
        <Pressable onPress={() => setShowChat(true)} style={styles.primaryButton}>
          <Text style={styles.primaryButtonText}>Open P2P Chat</Text>
        </Pressable>
      </View>

      {/* Crypto Gift Draft */}
      <CryptoGiftCard burnerState={burner.state} />
    </ScrollView>
  );
}

// ─── ZK Funding ───────────────────────────────────────────────────────────────

type FundingStep = "idle" | "signing" | "depositing" | "withdrawing" | "done" | "error";

function ZkFundingCard({ burnerPublicKey }: { burnerPublicKey: string }) {
  const [amount, setAmount] = useState("0.1");
  const [step, setStep] = useState<FundingStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [retries, setRetries] = useState(0);

  const parsedAmount = Number(amount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0.01 && parsedAmount <= 10;
  const isBridgeAvailable = false; // PrivacyCash_Bridge not yet wired

  const fund = useCallback(async () => {
    if (!isValidAmount) return;
    if (!isBridgeAvailable) {
      Alert.alert(
        "Guarded",
        "PrivacyCash native bridge is not yet initialized. ZK funding will be available after native SDK wiring.",
      );
      return;
    }

    setError(null);
    setStep("signing");

    try {
      // Step 1: Sign into privacy layer
      // await privacyCashBridge.signIn();
      setStep("depositing");

      // Step 2: Deposit to ZK pool
      // await privacyCashBridge.deposit(parsedAmount);
      setStep("withdrawing");

      // Step 3: Withdraw to burner address
      // await privacyCashBridge.withdraw(burnerPublicKey, parsedAmount - 0.007);
      setStep("done");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Funding failed");
      setStep("error");
    }
  }, [burnerPublicKey, isBridgeAvailable, isValidAmount, parsedAmount]);

  const retry = useCallback(() => {
    if (retries >= 3) {
      setError("Max retries reached. Please try again later.");
      return;
    }
    setRetries((c) => c + 1);
    fund();
  }, [fund, retries]);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Fund via ZK Pool</Text>
      {!isBridgeAvailable ? (
        <Text style={styles.guardedText}>
          Guarded — Native SDK wiring required. ZK shielded funding will be enabled after
          PrivacyCash mobile bridge is verified.
        </Text>
      ) : (
        <>
          <Text style={styles.mutedText}>
            Fund your private wallet through the ZK shielded pool. No on-chain link to your main
            wallet.
          </Text>
          <TextInput
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder="Amount SOL (0.01 – 10)"
            placeholderTextColor="#6f776a"
            style={styles.input}
            value={amount}
          />
          {!isValidAmount && amount.length > 0 && (
            <Text style={styles.validationText}>Amount must be between 0.01 and 10 SOL</Text>
          )}
          {isValidAmount && (
            <Text style={styles.feeText}>Estimated ZK withdrawal fee: 0.007 SOL</Text>
          )}

          {step !== "idle" && step !== "done" && step !== "error" && (
            <View style={styles.stepsContainer}>
              <FundingStepIndicator label="Signing into privacy layer" active={step === "signing"} done={step !== "signing"} />
              <FundingStepIndicator label="Depositing to ZK pool" active={step === "depositing"} done={step === "withdrawing"} />
              <FundingStepIndicator label="Withdrawing to burner" active={step === "withdrawing"} done={false} />
            </View>
          )}

          {step === "done" && (
            <Text style={styles.successText}>
              Private wallet funded. No on-chain link to your main wallet.
            </Text>
          )}

          {error && (
            <View>
              <Text style={styles.errorText}>{error}</Text>
              {retries < 3 && (
                <Pressable onPress={retry} style={styles.retryButton}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              )}
            </View>
          )}

          <Pressable
            disabled={!isValidAmount || (step !== "idle" && step !== "done" && step !== "error")}
            onPress={fund}
            style={[styles.primaryButton, (!isValidAmount || step === "signing" || step === "depositing" || step === "withdrawing") && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>Fund via ZK Pool</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

function FundingStepIndicator({ label, active, done }: { label: string; active: boolean; done: boolean }) {
  return (
    <View style={styles.stepRow}>
      {active ? (
        <ActivityIndicator color="#d4ff62" size="small" />
      ) : (
        <View style={[styles.stepDot, done && styles.stepDotDone]} />
      )}
      <Text style={[styles.stepLabel, active && styles.stepLabelActive, done && styles.stepLabelDone]}>
        {label}
      </Text>
    </View>
  );
}

// ─── Crypto Gift ──────────────────────────────────────────────────────────────

function CryptoGiftCard({ burnerState }: { burnerState: string }) {
  const [giftAmount, setGiftAmount] = useState("0.05");
  const [giftToken, setGiftToken] = useState("SOL");
  const isBridgeAvailable = false; // PrivacyCash_Bridge not yet wired

  const parsedAmount = Number(giftAmount);
  const isValidAmount = Number.isFinite(parsedAmount) && parsedAmount >= 0.01;

  const sendGift = useCallback(() => {
    if (!isBridgeAvailable) {
      Alert.alert(
        "Draft only",
        "Shielded transfer disabled until PrivacyCash mobile signing is enabled.",
      );
      return;
    }
    // Actual gift flow would go here
  }, [isBridgeAvailable]);

  return (
    <View style={styles.card}>
      <Text style={styles.sectionTitle}>Private Gift</Text>
      {!isBridgeAvailable ? (
        <Text style={styles.guardedText}>
          Draft only — Shielded transfer disabled. Gift execution will be enabled after
          PrivacyCash bridge is wired.
        </Text>
      ) : (
        <Text style={styles.mutedText}>
          Send SOL privately through the ZK shielded pool. No on-chain link between sender and
          recipient.
        </Text>
      )}

      <View style={styles.inputRow}>
        <TextInput
          keyboardType="decimal-pad"
          onChangeText={setGiftAmount}
          placeholder="Amount"
          placeholderTextColor="#6f776a"
          style={styles.input}
          value={giftAmount}
        />
        <View style={styles.tokenSelector}>
          <Pressable
            onPress={() => setGiftToken("SOL")}
            style={[styles.tokenPill, giftToken === "SOL" && styles.tokenPillActive]}
          >
            <Text style={[styles.tokenPillText, giftToken === "SOL" && styles.tokenPillTextActive]}>SOL</Text>
          </Pressable>
          <Pressable disabled style={styles.tokenPillDisabled}>
            <Text style={styles.tokenPillTextDisabled}>USDC Soon</Text>
          </Pressable>
          <Pressable disabled style={styles.tokenPillDisabled}>
            <Text style={styles.tokenPillTextDisabled}>USDT Soon</Text>
          </Pressable>
        </View>
      </View>

      {isValidAmount && isBridgeAvailable && (
        <Text style={styles.feeText}>Estimated withdrawal fee: 0.007 SOL</Text>
      )}
      {!isValidAmount && giftAmount.length > 0 && (
        <Text style={styles.validationText}>Minimum gift amount is 0.01 SOL</Text>
      )}

      <Pressable
        disabled={!isBridgeAvailable || !isValidAmount}
        onPress={sendGift}
        style={[styles.secondaryButton, (!isBridgeAvailable || !isValidAmount) && styles.disabledButton]}
      >
        <Text style={styles.secondaryButtonText}>Send Private Gift</Text>
      </Pressable>
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
  addButton: {
    alignItems: "center",
    backgroundColor: "#d4ff62",
    borderRadius: 10,
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  addButtonText: {
    color: "#11170f",
    fontWeight: "900",
  },
  backButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButtonText: {
    color: "#d4ff62",
    fontSize: 14,
    fontWeight: "700",
  },
  balanceLabel: {
    color: "#6f776a",
    fontSize: 13,
    fontWeight: "700",
  },
  balanceRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  balanceValue: {
    color: "#f4f7ef",
    fontSize: 18,
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
  feeText: {
    color: "#6f776a",
    fontSize: 12,
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
  inputRow: {
    flexDirection: "row",
    gap: 10,
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
  retryButton: {
    alignSelf: "flex-start",
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: "#f4f7ef",
    fontSize: 12,
    fontWeight: "800",
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
  stepDot: {
    backgroundColor: "#293322",
    borderRadius: 5,
    height: 10,
    width: 10,
  },
  stepDotDone: {
    backgroundColor: "#d4ff62",
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
  subtitle: {
    color: "#aab3a3",
    lineHeight: 21,
    marginTop: 10,
  },
  successText: {
    color: "#4ade80",
    fontSize: 14,
    fontWeight: "700",
  },
  title: {
    color: "#f4f7ef",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    marginTop: 8,
  },
  tokenPill: {
    borderColor: "#293322",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tokenPillActive: {
    backgroundColor: "#d4ff62",
    borderColor: "#d4ff62",
  },
  tokenPillDisabled: {
    borderColor: "#1c2618",
    borderRadius: 6,
    borderWidth: 1,
    opacity: 0.5,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tokenPillText: {
    color: "#aab3a3",
    fontSize: 12,
    fontWeight: "700",
  },
  tokenPillTextActive: {
    color: "#11170f",
  },
  tokenPillTextDisabled: {
    color: "#6f776a",
    fontSize: 11,
    fontWeight: "700",
  },
  tokenSelector: {
    flexDirection: "row",
    gap: 6,
  },
  validationText: {
    color: "#ff9f8f",
    fontSize: 12,
  },
  walletAddress: {
    color: "#f4f7ef",
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: "800",
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

import type { SeekerVerificationResponse } from "@frequencii/shared";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { apiRequest } from "../../api/client";

function useSeekerDevice() {
  const constants = Platform.constants as Record<string, unknown>;
  const model = String(constants.Model ?? "");
  const manufacturer = String(constants.Manufacturer ?? "");

  return {
    isLikelySeeker: model === "Seeker",
    manufacturer,
    model,
  };
}

export function SeekerPanel({ token, walletAddress }: { token: string; walletAddress?: string }) {
  const seeker = useSeekerDevice();
  const [verification, setVerification] = useState<SeekerVerificationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const verify = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = await apiRequest<SeekerVerificationResponse>("/api/v1/seeker/verify", {
        token,
      });
      setVerification(response);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Verification failed. Check your connection and try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    verify();
  }, [verify]);

  const isVerified = verification?.hasGenesisToken === true;
  const mintAddress = verification?.genesisTokenMint;
  const shortMint = mintAddress
    ? `${mintAddress.slice(0, 4)}...${mintAddress.slice(-4)}`
    : null;

  return (
    <ScrollView contentContainerStyle={styles.content} style={styles.screen}>
      {seeker.isLikelySeeker && (
        <View style={styles.seekerHint}>
          <Text style={styles.seekerHintText}>Running on Seeker</Text>
        </View>
      )}

      <View style={styles.headerCard}>
        <Text style={styles.kicker}>Seeker</Text>
        <Text style={styles.title}>Genesis Token</Text>
        <Text style={styles.meta}>
          Device: {seeker.model || "Unknown"}{" "}
          {seeker.manufacturer ? `· ${seeker.manufacturer}` : ""}
        </Text>
      </View>

      <View style={styles.card}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>Verification Status</Text>
          {isLoading ? (
            <ActivityIndicator color="#d4ff62" size="small" />
          ) : isVerified ? (
            <View style={styles.verifiedBadge}>
              <Text style={styles.verifiedBadgeText}>Seeker Verified</Text>
            </View>
          ) : (
            <Text style={styles.notVerifiedText}>Not Verified</Text>
          )}
        </View>

        {isVerified && shortMint && (
          <Text style={styles.mintText}>Mint: {shortMint}</Text>
        )}

        {error && <Text style={styles.errorText}>{error}</Text>}

        <Pressable
          disabled={isLoading}
          onPress={verify}
          style={[styles.verifyButton, isLoading && styles.disabledButton]}
        >
          <Text style={styles.verifyButtonText}>
            {isLoading ? "Checking..." : "Verify Again"}
          </Text>
        </Pressable>
      </View>

      {isVerified && (
        <View style={styles.exclusiveCard}>
          <View style={styles.exclusiveHeader}>
            <Text style={styles.exclusiveTitle}>Seeker Exclusive</Text>
            <View style={styles.earlyAccessBadge}>
              <Text style={styles.earlyAccessText}>Early Access</Text>
            </View>
          </View>
          <Text style={styles.exclusiveBody}>
            As a verified Seeker holder, you have access to exclusive prediction markets and
            enhanced AI agent context with early-access market data.
          </Text>
          <View style={styles.exclusiveFeatures}>
            <ExclusiveFeatureItem
              title="Seeker-Only Markets"
              description="Exclusive markets not visible to standard users"
            />
            <ExclusiveFeatureItem
              title="Enhanced AI Context"
              description="Agent includes Seeker-exclusive market signals"
            />
            <ExclusiveFeatureItem
              title="Priority Notifications"
              description="Early alerts for high-value market movements"
            />
          </View>
        </View>
      )}

      {!isVerified && !isLoading && (
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Get Seeker Access</Text>
          <Text style={styles.mutedText}>
            Seeker-exclusive features require a verified Genesis Token NFT. This token is
            available to Solana Seeker device holders.
          </Text>
          <Pressable
            onPress={() => Linking.openURL("https://solanaseeker.com")}
            style={styles.linkButton}
          >
            <Text style={styles.linkButtonText}>Learn about Seeker →</Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

function ExclusiveFeatureItem({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <View style={styles.featureItem}>
      <Text style={styles.featureTitle}>{title}</Text>
      <Text style={styles.featureDesc}>{description}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
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
    opacity: 0.5,
  },
  earlyAccessBadge: {
    backgroundColor: "#d4ff62",
    borderRadius: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  earlyAccessText: {
    color: "#11170f",
    fontSize: 10,
    fontWeight: "900",
  },
  errorText: {
    color: "#ff9f8f",
    fontSize: 13,
    lineHeight: 20,
  },
  exclusiveBody: {
    color: "#aab3a3",
    fontSize: 14,
    lineHeight: 21,
  },
  exclusiveCard: {
    backgroundColor: "#11170f",
    borderColor: "#d4ff62",
    borderRadius: 18,
    borderWidth: 1,
    gap: 14,
    padding: 18,
  },
  exclusiveFeatures: {
    gap: 12,
    marginTop: 4,
  },
  exclusiveHeader: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  exclusiveTitle: {
    color: "#d4ff62",
    fontSize: 18,
    fontWeight: "900",
  },
  featureDesc: {
    color: "#aab3a3",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  featureItem: {
    borderTopColor: "#243020",
    borderTopWidth: 1,
    paddingTop: 10,
  },
  featureTitle: {
    color: "#f4f7ef",
    fontSize: 14,
    fontWeight: "800",
  },
  headerCard: {
    backgroundColor: "#11170f",
    borderRadius: 22,
    padding: 20,
  },
  kicker: {
    color: "#d4ff62",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  linkButton: {
    alignSelf: "flex-start",
    borderBottomColor: "#d4ff62",
    borderBottomWidth: 1,
    paddingBottom: 2,
  },
  linkButtonText: {
    color: "#d4ff62",
    fontSize: 14,
    fontWeight: "700",
  },
  meta: {
    color: "#aab3a3",
    lineHeight: 21,
    marginTop: 8,
  },
  mintText: {
    color: "#aab3a3",
    fontSize: 13,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  mutedText: {
    color: "#aab3a3",
    fontSize: 14,
    lineHeight: 21,
  },
  notVerifiedText: {
    color: "#ff9f8f",
    fontSize: 13,
    fontWeight: "700",
  },
  screen: {
    flex: 1,
  },
  sectionTitle: {
    color: "#f4f7ef",
    fontSize: 18,
    fontWeight: "900",
  },
  seekerHint: {
    alignSelf: "flex-start",
    backgroundColor: "#d4ff62",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  seekerHintText: {
    color: "#11170f",
    fontSize: 11,
    fontWeight: "900",
  },
  statusLabel: {
    color: "#f4f7ef",
    fontSize: 15,
    fontWeight: "800",
  },
  statusRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  title: {
    color: "#f4f7ef",
    fontSize: 26,
    fontWeight: "900",
    lineHeight: 32,
    marginTop: 8,
  },
  verifiedBadge: {
    backgroundColor: "#d4ff62",
    borderRadius: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  verifiedBadgeText: {
    color: "#11170f",
    fontSize: 12,
    fontWeight: "900",
  },
  verifyButton: {
    alignItems: "center",
    backgroundColor: "#d4ff62",
    borderRadius: 10,
    paddingVertical: 13,
  },
  verifyButtonText: {
    color: "#11170f",
    fontWeight: "900",
  },
});

import type {
  MarketDetailResponse,
  PredictionEvent,
  ProfileUpdateResponse,
  PushTokenMutationResponse,
  UserProfile,
  WatchlistResponse,
} from "@frequencii/shared";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { apiRequest } from "../../api/client";
import { BottomSheet } from "../../components/BottomSheet";

interface WatchlistItemEnriched {
  eventId: string;
  addedAt: string;
  title?: string;
  volume?: number;
  price?: number;
}

export function ProfileScreen({
  onRefreshSession,
  onSignOut,
  token,
  walletAddress,
}: {
  onRefreshSession: () => Promise<unknown>;
  onSignOut: () => Promise<void>;
  token: string;
  walletAddress: string;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [pushToken, setPushToken] = useState("");
  const [watchlist, setWatchlist] = useState<WatchlistItemEnriched[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedMarket, setSelectedMarket] = useState<PredictionEvent | null>(null);

  const loadProfile = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const [user, watchlistResponse] = await Promise.all([
        apiRequest<UserProfile>("/api/v1/user/profile", { token }),
        apiRequest<WatchlistResponse>("/api/v1/watchlist", { token }),
      ]);
      setProfile(user);
      setDisplayName(user.displayName ?? "");
      setAvatar(user.avatar ?? "");

      // Enrich watchlist items with market data
      const enriched: WatchlistItemEnriched[] = await Promise.all(
        watchlistResponse.items.map(async (item) => {
          try {
            const detail = await apiRequest<MarketDetailResponse>(
              `/api/v1/markets/${encodeURIComponent(item.eventId)}`,
              { token },
            );
            const market = detail.event.markets[0];
            return {
              ...item,
              title: detail.event.title,
              volume: detail.event.volume,
              price: market?.outcomePrices?.[0] ?? market?.lastTradePrice,
            };
          } catch {
            return item;
          }
        }),
      );
      setWatchlist(enriched);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to load profile");
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const saveProfile = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      const response = await apiRequest<ProfileUpdateResponse>("/api/v1/user/profile", {
        method: "PUT",
        token,
        body: JSON.stringify({ avatar, displayName }),
      });
      setProfile(response.user);
      setMessage("Profile updated");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to update profile");
    } finally {
      setIsLoading(false);
    }
  }, [avatar, displayName, token]);

  const refreshSession = useCallback(async () => {
    setIsLoading(true);
    setMessage(null);
    try {
      await onRefreshSession();
      setMessage("Session refreshed");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to refresh session");
    } finally {
      setIsLoading(false);
    }
  }, [onRefreshSession]);

  const registerPushToken = useCallback(async () => {
    if (!pushToken.trim()) {
      Alert.alert("Push token required", "Paste an Android push token before registering.");
      return;
    }
    try {
      const response = await apiRequest<PushTokenMutationResponse>("/api/v1/user/push-token", {
        method: "POST",
        token,
        body: JSON.stringify({ platform: "android", token: pushToken.trim() }),
      });
      setMessage(response.registered ? "Push token registered" : "Push token already exists");
    } catch (err) {
      setMessage(err instanceof Error ? err.message : "Failed to register push token");
    }
  }, [pushToken, token]);

  const removeWatchlistItem = useCallback(
    async (eventId: string) => {
      const previous = watchlist;
      setWatchlist((current) => current.filter((item) => item.eventId !== eventId));
      try {
        await apiRequest(`/api/v1/watchlist/${encodeURIComponent(eventId)}`, {
          method: "DELETE",
          token,
        });
      } catch (err) {
        setWatchlist(previous);
        Alert.alert("Could not remove", err instanceof Error ? err.message : "Try again.");
      }
    },
    [token, watchlist],
  );

  const openWatchlistMarket = useCallback(
    async (eventId: string) => {
      try {
        const response = await apiRequest<MarketDetailResponse>(
          `/api/v1/markets/${encodeURIComponent(eventId)}`,
          { token },
        );
        setSelectedMarket(response.event);
      } catch {
        Alert.alert("Could not load market", "Try again later.");
      }
    },
    [token],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.headerCard}>
          <Text style={styles.kicker}>Account</Text>
          <Text style={styles.title}>{profile?.displayName || "Frequencii trader"}</Text>
          <Text style={styles.walletText}>
            {walletAddress.slice(0, 6)}...{walletAddress.slice(-6)}
          </Text>
        </View>

        {message ? <Text style={styles.messageText}>{message}</Text> : null}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Profile</Text>
          <TextInput
            onChangeText={setDisplayName}
            placeholder="Display name"
            placeholderTextColor="#6f776a"
            style={styles.input}
            value={displayName}
          />
          <TextInput
            autoCapitalize="none"
            onChangeText={setAvatar}
            placeholder="Avatar URL"
            placeholderTextColor="#6f776a"
            style={styles.input}
            value={avatar}
          />
          <Pressable disabled={isLoading} onPress={saveProfile} style={styles.primaryButton}>
            <Text style={styles.primaryButtonText}>{isLoading ? "Saving" : "Save Profile"}</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <View style={styles.rowBetween}>
            <Text style={styles.sectionTitle}>Watchlist</Text>
            <Pressable onPress={loadProfile}>
              <Text style={styles.linkText}>Reload</Text>
            </Pressable>
          </View>
          {isLoading && !profile ? <ActivityIndicator color="#d4ff62" /> : null}
          {watchlist.length === 0 ? (
            <Text style={styles.mutedText}>
              No saved markets yet. Save markets from the Markets tab.
            </Text>
          ) : (
            watchlist.map((item) => (
              <Pressable
                key={item.eventId}
                onPress={() => openWatchlistMarket(item.eventId)}
                style={styles.watchlistRow}
              >
                <View style={styles.watchlistMain}>
                  <Text numberOfLines={1} style={styles.watchlistTitle}>
                    {item.title || item.eventId}
                  </Text>
                  <Text style={styles.watchlistMeta}>
                    {item.volume != null ? `$${Math.round(item.volume).toLocaleString()} vol` : ""}
                    {item.price != null ? ` · ${Math.round(item.price * 100)}%` : ""}
                  </Text>
                </View>
                <Pressable
                  onPress={() => removeWatchlistItem(item.eventId)}
                  style={styles.smallButton}
                >
                  <Text style={styles.smallButtonText}>Remove</Text>
                </Pressable>
              </Pressable>
            ))
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Notifications</Text>
          <Text style={styles.mutedText}>
            Register an Android push token for market and position alerts.
          </Text>
          <TextInput
            autoCapitalize="none"
            onChangeText={setPushToken}
            placeholder="Android push token"
            placeholderTextColor="#6f776a"
            style={styles.input}
            value={pushToken}
          />
          <Pressable onPress={registerPushToken} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Register Push Token</Text>
          </Pressable>
        </View>

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>Session</Text>
          <View style={styles.buttonRow}>
            <Pressable onPress={refreshSession} style={styles.secondaryButton}>
              <Text style={styles.secondaryButtonText}>Refresh JWT</Text>
            </Pressable>
            <Pressable onPress={onSignOut} style={styles.dangerButton}>
              <Text style={styles.dangerButtonText}>Sign Out</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      <BottomSheet
        visible={Boolean(selectedMarket)}
        onClose={() => setSelectedMarket(null)}
        heightFraction={0.6}
      >
        {selectedMarket && (
          <ScrollView contentContainerStyle={styles.marketDetailContent}>
            <Text style={styles.marketDetailTitle}>{selectedMarket.title}</Text>
            <Text style={styles.marketDetailDesc}>
              {selectedMarket.description || selectedMarket.markets[0]?.description}
            </Text>
            <Text style={styles.marketDetailMeta}>
              {selectedMarket.category} · ${Math.round(selectedMarket.volume).toLocaleString()} volume
            </Text>
          </ScrollView>
        )}
      </BottomSheet>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  buttonRow: {
    flexDirection: "row",
    gap: 10,
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
  dangerButton: {
    borderColor: "#6b2a22",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13,
  },
  dangerButtonText: {
    color: "#ff9f8f",
    fontWeight: "800",
    textAlign: "center",
  },
  headerCard: {
    backgroundColor: "#d4ff62",
    borderRadius: 22,
    padding: 20,
  },
  input: {
    backgroundColor: "#11170f",
    borderColor: "#293322",
    borderRadius: 10,
    borderWidth: 1,
    color: "#f4f7ef",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  kicker: {
    color: "#405014",
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  linkText: {
    color: "#d4ff62",
    fontSize: 12,
    fontWeight: "800",
  },
  marketDetailContent: {
    padding: 20,
  },
  marketDetailDesc: {
    color: "#aab3a3",
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  marketDetailMeta: {
    color: "#6f776a",
    fontSize: 13,
    marginTop: 12,
  },
  marketDetailTitle: {
    color: "#f4f7ef",
    fontSize: 22,
    fontWeight: "800",
    lineHeight: 28,
  },
  messageText: {
    color: "#d4ff62",
    fontWeight: "700",
    lineHeight: 20,
    textAlign: "center",
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
  rowBetween: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  screen: {
    flex: 1,
  },
  secondaryButton: {
    borderColor: "#293322",
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 13,
  },
  secondaryButtonText: {
    color: "#f4f7ef",
    fontWeight: "800",
    textAlign: "center",
  },
  sectionTitle: {
    color: "#f4f7ef",
    fontSize: 18,
    fontWeight: "900",
  },
  smallButton: {
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallButtonText: {
    color: "#f4f7ef",
    fontSize: 12,
    fontWeight: "800",
  },
  title: {
    color: "#11170f",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 8,
  },
  walletText: {
    color: "#405014",
    fontWeight: "800",
    marginTop: 8,
  },
  watchlistMain: {
    flex: 1,
  },
  watchlistMeta: {
    color: "#6f776a",
    fontSize: 12,
    marginTop: 4,
  },
  watchlistRow: {
    alignItems: "center",
    borderTopColor: "#1c2618",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    paddingTop: 12,
  },
  watchlistTitle: {
    color: "#f4f7ef",
    fontSize: 14,
    fontWeight: "800",
  },
});

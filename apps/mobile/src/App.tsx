import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  SafeAreaView,
  StatusBar as RNStatusBar,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useState } from "react";
import { AgentScreen } from "./features/agent/AgentScreen";
import { useMobileAgent } from "./features/agent/useMobileAgent";
import { MarketsScreen } from "./features/markets/MarketsScreen";
import { PositionsScreen } from "./features/positions/PositionsScreen";
import { PrivacyScreen } from "./features/privacy/PrivacyScreen";
import { ProfileScreen } from "./features/profile/ProfileScreen";
import { SeekerPanel } from "./features/seeker/SeekerPanel";
import { useMobileAuth } from "./features/auth/useMobileAuth";
import { MobileWalletProvider } from "./solana/MobileWalletProvider";

type ActiveTab = "agent" | "markets" | "positions" | "privacy" | "seeker" | "profile";

const tabs: { key: ActiveTab; label: string; icon: string }[] = [
  { key: "agent", label: "Agent", icon: "🤖" },
  { key: "markets", label: "Markets", icon: "📊" },
  { key: "positions", label: "Portfolio", icon: "💰" },
  { key: "privacy", label: "Privacy", icon: "🔒" },
  { key: "seeker", label: "Seeker", icon: "🔍" },
  { key: "profile", label: "Profile", icon: "👤" },
];

function AppShell() {
  const auth = useMobileAuth();
  const agent = useMobileAgent(auth.token ?? "");
  const [activeTab, setActiveTab] = useState<ActiveTab>("markets");
  const walletAddress = auth.wallet.address;

  if (auth.isRestoring) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.centerState}>
          <ActivityIndicator color="#d4ff62" />
          <Text style={styles.mutedText}>Restoring session</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!auth.token || !walletAddress) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar style="light" />
        <View style={styles.hero}>
          <Text style={styles.kicker}>Solana Mobile</Text>
          <Text style={styles.title}>Frequencii</Text>
          <Text style={styles.body}>
            Private prediction markets wired for Mobile Wallet Adapter and Seeker.
          </Text>
          {auth.isSigningIn ? (
            <Text style={styles.helpText}>
              Unlock Phantom and approve the request. If Phantom only opens the home screen, cancel
              and connect again.
            </Text>
          ) : null}
          {auth.error ? <Text style={styles.errorText}>{auth.error}</Text> : null}
          {auth.error || auth.isSigningIn ? (
            <Pressable
              onPress={() => auth.resetWalletSession()}
              style={styles.resetButton}
            >
              <Text style={styles.resetButtonText}>
                {auth.isSigningIn ? "Cancel Wallet Request" : "Reset Wallet Session"}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            disabled={auth.isSigningIn}
            onPress={() => auth.signIn()}
            style={[styles.primaryButton, auth.isSigningIn && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {auth.isSigningIn ? "Waiting for wallet" : "Connect Wallet"}
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Frequencii</Text>
          <Text style={styles.walletText}>
            {walletAddress.slice(0, 4)}...{walletAddress.slice(-4)}
          </Text>
        </View>
        <Pressable onPress={() => auth.signOut()} style={styles.signOutButton}>
          <Text style={styles.signOutButtonText}>Sign Out</Text>
        </Pressable>
      </View>

      <View style={styles.content}>
        {activeTab === "agent" ? (
          <AgentScreen token={auth.token} agent={agent} />
        ) : activeTab === "markets" ? (
          <MarketsScreen token={auth.token} walletAddress={walletAddress} />
        ) : activeTab === "positions" ? (
          <PositionsScreen token={auth.token} walletAddress={walletAddress} />
        ) : activeTab === "privacy" ? (
          <PrivacyScreen walletAddress={walletAddress} token={auth.token} />
        ) : activeTab === "seeker" ? (
          <SeekerPanel token={auth.token} walletAddress={walletAddress} />
        ) : (
          <ProfileScreen
            onRefreshSession={auth.refreshSession}
            onSignOut={auth.signOut}
            token={auth.token}
            walletAddress={walletAddress}
          />
        )}
      </View>

      <View style={styles.bottomBar}>
        {tabs.map((tab) => (
          <Pressable
            key={tab.key}
            onPress={() => setActiveTab(tab.key)}
            style={styles.tabItem}
            accessibilityRole="tab"
            accessibilityState={{ selected: activeTab === tab.key }}
          >
            <Text style={styles.tabIcon}>{tab.icon}</Text>
            <Text
              style={[
                styles.tabLabel,
                activeTab === tab.key && styles.tabLabelActive,
              ]}
            >
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={styles.tabIndicator} />}
          </Pressable>
        ))}
      </View>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <MobileWalletProvider>
      <AppShell />
    </MobileWalletProvider>
  );
}

const styles = StyleSheet.create({
  body: {
    color: "#aab3a3",
    fontSize: 16,
    lineHeight: 24,
    marginTop: 12,
    maxWidth: 320,
  },
  bottomBar: {
    borderTopColor: "#1c2618",
    borderTopWidth: 1,
    flexDirection: "row",
    paddingBottom: Platform.OS === "android" ? 8 : 20,
    paddingTop: 8,
  },
  centerState: {
    alignItems: "center",
    flex: 1,
    gap: 12,
    justifyContent: "center",
    padding: 24,
  },
  content: {
    flex: 1,
  },
  disabledButton: {
    opacity: 0.5,
  },
  errorText: {
    color: "#ff9f8f",
    lineHeight: 22,
    marginTop: 18,
  },
  header: {
    alignItems: "center",
    borderBottomColor: "#1c2618",
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerTitle: {
    color: "#f4f7ef",
    fontSize: 20,
    fontWeight: "800",
    letterSpacing: 0,
  },
  helpText: {
    color: "#d8e8c8",
    lineHeight: 22,
    marginTop: 18,
  },
  hero: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
  },
  kicker: {
    color: "#d4ff62",
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0,
    marginBottom: 10,
    textTransform: "uppercase",
  },
  mutedText: {
    color: "#aab3a3",
  },
  primaryButton: {
    alignItems: "center",
    backgroundColor: "#d4ff62",
    borderRadius: 8,
    marginTop: 28,
    paddingVertical: 15,
  },
  primaryButtonText: {
    color: "#11170f",
    fontWeight: "800",
  },
  resetButton: {
    alignItems: "center",
    borderColor: "#3c4c34",
    borderRadius: 8,
    borderWidth: 1,
    marginTop: 16,
    paddingVertical: 13,
  },
  resetButtonText: {
    color: "#f4f7ef",
    fontWeight: "800",
  },
  screen: {
    backgroundColor: "#070907",
    flex: 1,
    paddingTop: Platform.OS === "android" ? RNStatusBar.currentHeight ?? 0 : 0,
  },
  signOutButton: {
    borderColor: "#293322",
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  signOutButtonText: {
    color: "#f4f7ef",
    fontSize: 12,
    fontWeight: "700",
  },
  tabIcon: {
    fontSize: 18,
  },
  tabIndicator: {
    backgroundColor: "#d4ff62",
    borderRadius: 2,
    height: 3,
    marginTop: 4,
    width: 20,
  },
  tabItem: {
    alignItems: "center",
    flex: 1,
    minHeight: 44,
    minWidth: 44,
    paddingVertical: 4,
  },
  tabLabel: {
    color: "#6f776a",
    fontSize: 10,
    fontWeight: "700",
    marginTop: 2,
  },
  tabLabelActive: {
    color: "#d4ff62",
  },
  title: {
    color: "#f4f7ef",
    fontSize: 36,
    fontWeight: "800",
    letterSpacing: 0,
  },
  walletText: {
    color: "#aab3a3",
    fontSize: 13,
    marginTop: 2,
  },
});

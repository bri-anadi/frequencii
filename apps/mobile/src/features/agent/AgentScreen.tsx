import type { AgentMessage, MarketsResponse, PredictionEvent } from "@frequencii/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
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
import { useMobileAgent } from "./useMobileAgent";

const quickActions = [
  "Top trending markets",
  "What should I watch today?",
  "Explain prediction market risk",
  "Find high-volume crypto markets",
];

export function AgentScreen({ token }: { token: string }) {
  const agent = useMobileAgent(token);
  const [input, setInput] = useState("");
  const [markets, setMarkets] = useState<PredictionEvent[]>([]);
  const [selectedMarket, setSelectedMarket] = useState<PredictionEvent | null>(null);
  const [isLoadingMarkets, setIsLoadingMarkets] = useState(false);
  const listRef = useRef<FlatList<AgentMessage>>(null);

  const loadTrendingMarkets = useCallback(async () => {
    setIsLoadingMarkets(true);
    try {
      const response = await apiRequest<MarketsResponse>("/api/v1/markets?limit=5&offset=0", {
        token,
      });
      setMarkets(response.events);
    } catch {
      setMarkets([]);
    } finally {
      setIsLoadingMarkets(false);
    }
  }, [token]);

  useEffect(() => {
    loadTrendingMarkets();
  }, [loadTrendingMarkets]);

  useEffect(() => {
    if (agent.messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [agent.messages.length]);

  const submit = useCallback(
    async (text = input) => {
      const trimmed = text.trim();
      if (!trimmed) return;

      setInput("");
      await agent.sendMessage(trimmed, selectedMarket, markets);
    },
    [agent, input, markets, selectedMarket],
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.hero}>
        <Text style={styles.kicker}>Frequant AI</Text>
        <Text style={styles.title}>Prediction analyst in your pocket.</Text>
        <Text style={styles.subtitle}>
          Ask for market analysis, risk checks, probability shifts, or what is trending.
        </Text>
      </View>

      <View style={styles.quickPanel}>
        <View style={styles.panelHeader}>
          <Text style={styles.panelTitle}>Context</Text>
          <Pressable onPress={loadTrendingMarkets}>
            <Text style={styles.linkText}>{isLoadingMarkets ? "Loading" : "Refresh"}</Text>
          </Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <Pressable
            onPress={() => setSelectedMarket(null)}
            style={[styles.marketChip, !selectedMarket && styles.marketChipActive]}
          >
            <Text style={[styles.marketChipText, !selectedMarket && styles.marketChipTextActive]}>
              Global
            </Text>
          </Pressable>
          {markets.map((market) => (
            <Pressable
              key={market.id}
              onPress={() => setSelectedMarket(market)}
              style={[styles.marketChip, selectedMarket?.id === market.id && styles.marketChipActive]}
            >
              <Text
                numberOfLines={1}
                style={[
                  styles.marketChipText,
                  selectedMarket?.id === market.id && styles.marketChipTextActive,
                ]}
              >
                {market.title}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.quickScroller}>
          {quickActions.map((action) => (
            <Pressable
              disabled={agent.isStreaming}
              key={action}
              onPress={() => submit(action)}
              style={styles.quickButton}
            >
              <Text style={styles.quickButtonText}>{action}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      <FlatList
        contentContainerStyle={agent.messages.length === 0 && styles.emptyMessages}
        data={agent.messages}
        keyExtractor={(item) => item.id}
        ref={listRef}
        renderItem={({ item }) => <MessageBubble message={item} />}
        ListEmptyComponent={
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>Start with a market question</Text>
            <Text style={styles.emptyText}>
              Try “Analyze this market” after selecting context, or ask for trending opportunities.
            </Text>
          </View>
        }
      />

      <View style={styles.composer}>
        <TextInput
          editable={!agent.isStreaming}
          multiline
          onChangeText={setInput}
          placeholder="Ask Frequant..."
          placeholderTextColor="#6f776a"
          style={styles.input}
          value={input}
        />
        {agent.isStreaming ? (
          <Pressable onPress={agent.stopStreaming} style={styles.secondaryButton}>
            <Text style={styles.secondaryButtonText}>Stop</Text>
          </Pressable>
        ) : (
          <Pressable onPress={() => submit()} style={styles.sendButton}>
            <Text style={styles.sendButtonText}>Send</Text>
          </Pressable>
        )}
      </View>

      {agent.messages.length > 0 ? (
        <Pressable onPress={agent.clearHistory} style={styles.clearButton}>
          <Text style={styles.clearButtonText}>Clear chat</Text>
        </Pressable>
      ) : null}
    </KeyboardAvoidingView>
  );
}

function MessageBubble({ message }: { message: AgentMessage }) {
  const isUser = message.role === "user";

  return (
    <View style={[styles.messageRow, isUser && styles.messageRowUser]}>
      <View style={[styles.bubble, isUser ? styles.userBubble : styles.agentBubble]}>
        <Text style={[styles.messageMeta, isUser && styles.userMessageMeta]}>
          {isUser ? "You" : "Frequant"} · {message.timestamp}
        </Text>
        {message.isStreaming && !message.content ? (
          <View style={styles.streamingRow}>
            <ActivityIndicator color="#d4ff62" size="small" />
            <Text style={styles.agentText}>Thinking through market signals...</Text>
          </View>
        ) : (
          <Text style={isUser ? styles.userText : styles.agentText}>{message.content}</Text>
        )}
        {message.relatedMarketIds?.length ? (
          <Text style={styles.relatedText}>Related: {message.relatedMarketIds.join(", ")}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  agentBubble: {
    backgroundColor: "#11170f",
    borderColor: "#243020",
    borderWidth: 1,
  },
  agentText: {
    color: "#dfe7d8",
    fontSize: 15,
    lineHeight: 22,
  },
  bubble: {
    borderRadius: 16,
    maxWidth: "88%",
    padding: 14,
  },
  clearButton: {
    alignItems: "center",
    paddingBottom: 10,
    paddingTop: 2,
  },
  clearButtonText: {
    color: "#6f776a",
    fontSize: 12,
    fontWeight: "700",
  },
  composer: {
    alignItems: "flex-end",
    borderTopColor: "#1c2618",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  emptyCard: {
    alignItems: "center",
    borderColor: "#243020",
    borderRadius: 18,
    borderWidth: 1,
    padding: 20,
  },
  emptyMessages: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 20,
  },
  emptyText: {
    color: "#aab3a3",
    lineHeight: 21,
    marginTop: 8,
    textAlign: "center",
  },
  emptyTitle: {
    color: "#f4f7ef",
    fontSize: 18,
    fontWeight: "800",
  },
  hero: {
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  input: {
    backgroundColor: "#11170f",
    borderColor: "#293322",
    borderRadius: 14,
    borderWidth: 1,
    color: "#f4f7ef",
    flex: 1,
    maxHeight: 110,
    minHeight: 48,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  kicker: {
    color: "#d4ff62",
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  linkText: {
    color: "#d4ff62",
    fontSize: 12,
    fontWeight: "800",
  },
  marketChip: {
    borderColor: "#293322",
    borderRadius: 999,
    borderWidth: 1,
    marginRight: 8,
    maxWidth: 220,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  marketChipActive: {
    backgroundColor: "#d4ff62",
    borderColor: "#d4ff62",
  },
  marketChipText: {
    color: "#aab3a3",
    fontSize: 12,
    fontWeight: "700",
  },
  marketChipTextActive: {
    color: "#11170f",
  },
  messageMeta: {
    color: "#6f776a",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 8,
  },
  messageRow: {
    flexDirection: "row",
    marginBottom: 12,
    paddingHorizontal: 16,
  },
  messageRowUser: {
    justifyContent: "flex-end",
  },
  panelHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  panelTitle: {
    color: "#f4f7ef",
    fontWeight: "800",
  },
  quickButton: {
    backgroundColor: "#172011",
    borderRadius: 999,
    marginRight: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  quickButtonText: {
    color: "#dfe7d8",
    fontSize: 12,
    fontWeight: "700",
  },
  quickPanel: {
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  quickScroller: {
    marginTop: 10,
  },
  relatedText: {
    color: "#d4ff62",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 10,
  },
  screen: {
    flex: 1,
  },
  secondaryButton: {
    borderColor: "#293322",
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  secondaryButtonText: {
    color: "#f4f7ef",
    fontWeight: "800",
  },
  sendButton: {
    backgroundColor: "#d4ff62",
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingVertical: 15,
  },
  sendButtonText: {
    color: "#11170f",
    fontWeight: "900",
  },
  streamingRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 10,
  },
  subtitle: {
    color: "#aab3a3",
    fontSize: 14,
    lineHeight: 21,
    marginTop: 8,
  },
  title: {
    color: "#f4f7ef",
    fontSize: 24,
    fontWeight: "900",
    lineHeight: 30,
    marginTop: 6,
  },
  userBubble: {
    backgroundColor: "#d4ff62",
  },
  userMessageMeta: {
    color: "#405014",
  },
  userText: {
    color: "#11170f",
    fontSize: 15,
    fontWeight: "700",
    lineHeight: 22,
  },
});

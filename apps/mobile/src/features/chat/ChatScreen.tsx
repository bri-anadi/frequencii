import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { BottomSheet } from "../../components/BottomSheet";
import { hapticLight } from "../../utils/haptics";
import { useMagicBlockChat, MAX_MESSAGE_LENGTH } from "./useMagicBlockChat";
import type { ChatMessage } from "./useMagicBlockChat";

const CONTACTS_KEY = "frequencii_p2p_contacts";

type Contact = {
  address: string;
  label: string;
};

function isValidSolanaAddress(address: string): boolean {
  if (address.length < 32 || address.length > 44) return false;
  return /^[1-9A-HJ-NP-Za-km-z]+$/.test(address);
}

export function ChatScreen({ walletAddress }: { walletAddress: string }) {
  const chat = useMagicBlockChat(walletAddress);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [activeContact, setActiveContact] = useState<Contact | null>(null);
  const [newAddress, setNewAddress] = useState("");
  const [addressError, setAddressError] = useState<string | null>(null);

  // Load contacts from SecureStore
  useEffect(() => {
    async function load() {
      const stored = await SecureStore.getItemAsync(CONTACTS_KEY);
      if (stored) {
        try {
          setContacts(JSON.parse(stored));
        } catch {
          // Corrupted — start fresh
        }
      }
    }
    load();
  }, []);

  const saveContacts = useCallback(async (updated: Contact[]) => {
    setContacts(updated);
    await SecureStore.setItemAsync(CONTACTS_KEY, JSON.stringify(updated));
  }, []);

  const addContact = useCallback(() => {
    const address = newAddress.trim();
    setAddressError(null);

    if (!address) return;

    if (!isValidSolanaAddress(address)) {
      setAddressError("Invalid Solana wallet address");
      return;
    }

    if (contacts.some((c) => c.address === address)) {
      setAddressError("Contact already exists");
      return;
    }

    const updated = [...contacts, { address, label: `Contact ${contacts.length + 1}` }];
    saveContacts(updated);
    setNewAddress("");
  }, [contacts, newAddress, saveContacts]);

  const handleLongPress = useCallback(
    (contact: Contact) => {
      Alert.alert(contact.label, undefined, [
        {
          text: "Rename",
          onPress: () => {
            Alert.prompt?.(
              "Rename Contact",
              undefined,
              (name) => {
                if (name?.trim()) {
                  const updated = contacts.map((c) =>
                    c.address === contact.address ? { ...c, label: name.trim() } : c,
                  );
                  saveContacts(updated);
                }
              },
              "plain-text",
              contact.label,
            );
            // Fallback for Android (no Alert.prompt)
            if (!Alert.prompt) {
              const updated = contacts.map((c) =>
                c.address === contact.address
                  ? { ...c, label: `${contact.label} ✓` }
                  : c,
              );
              saveContacts(updated);
            }
          },
        },
        {
          text: "Remove Contact",
          style: "destructive",
          onPress: () => {
            const updated = contacts.filter((c) => c.address !== contact.address);
            saveContacts(updated);
          },
        },
        { text: "Cancel", style: "cancel" },
      ]);
    },
    [contacts, saveContacts],
  );

  // Chat initialization gate
  if (!chat.isInitialized) {
    return (
      <View style={styles.screen}>
        <View style={styles.initCard}>
          <Text style={styles.title}>P2P Chat</Text>
          <Text style={styles.mutedText}>
            Initialize your chat room on Solana L1 and delegate to MagicBlock Ephemeral Rollup
            for gasless messaging. This requires one transaction.
          </Text>
          {chat.error && <Text style={styles.errorText}>{chat.error}</Text>}
          <Pressable
            disabled={chat.isInitializing}
            onPress={chat.initialize}
            style={[styles.primaryButton, chat.isInitializing && styles.disabledButton]}
          >
            <Text style={styles.primaryButtonText}>
              {chat.isInitializing ? "Initializing..." : "Initialize Chat"}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Text style={styles.title}>P2P Chat</Text>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>Chat Active</Text>
        </View>
      </View>

      {/* Add contact */}
      <View style={styles.addRow}>
        <TextInput
          autoCapitalize="none"
          onChangeText={(text) => {
            setNewAddress(text);
            setAddressError(null);
          }}
          placeholder="Add wallet address"
          placeholderTextColor="#6f776a"
          style={styles.input}
          value={newAddress}
        />
        <Pressable onPress={addContact} style={styles.addButton}>
          <Text style={styles.addButtonText}>Add</Text>
        </Pressable>
      </View>
      {addressError && <Text style={styles.addressError}>{addressError}</Text>}

      {/* Contact list */}
      {contacts.length === 0 ? (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>No contacts yet</Text>
          <Text style={styles.mutedText}>
            Add a wallet address to start chatting.
          </Text>
        </View>
      ) : (
        <FlatList
          data={contacts}
          keyExtractor={(item) => item.address}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                setActiveContact(item);
                chat.startPolling(item.address);
              }}
              onLongPress={() => handleLongPress(item)}
              delayLongPress={500}
              style={styles.contactRow}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{item.label.charAt(0)}</Text>
              </View>
              <View style={styles.contactInfo}>
                <Text style={styles.contactLabel}>{item.label}</Text>
                <Text numberOfLines={1} style={styles.contactAddress}>
                  {item.address}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}

      {/* Chat bottom sheet */}
      <ChatBottomSheet
        contact={activeContact}
        messages={activeContact ? chat.getMessages(activeContact.address) : []}
        onClose={() => {
          chat.stopPolling();
          setActiveContact(null);
        }}
        onSend={(content) => {
          if (activeContact) {
            hapticLight();
            chat.sendMessage(activeContact.address, content);
          }
        }}
        onRetry={(messageId) => {
          if (activeContact) {
            chat.retryMessage(activeContact.address, messageId);
          }
        }}
      />
    </View>
  );
}

function ChatBottomSheet({
  contact,
  messages,
  onClose,
  onSend,
  onRetry,
}: {
  contact: Contact | null;
  messages: ChatMessage[];
  onClose: () => void;
  onSend: (content: string) => void;
  onRetry: (messageId: string) => void;
}) {
  const [input, setInput] = useState("");
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const charCount = input.length;
  const showCounter = charCount >= 261;

  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  const handleSend = useCallback(() => {
    const trimmed = input.trim();
    if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;
    onSend(trimmed);
    setInput("");
  }, [input, onSend]);

  return (
    <BottomSheet visible={Boolean(contact)} onClose={onClose} heightFraction={0.75}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.chatContainer}
      >
        <View style={styles.chatHeader}>
          <Text style={styles.chatTitle}>{contact?.label}</Text>
          <Text style={styles.chatAddress}>
            {contact?.address.slice(0, 6)}...{contact?.address.slice(-6)}
          </Text>
        </View>

        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          style={styles.messageList}
          contentContainerStyle={messages.length === 0 ? styles.emptyMessages : undefined}
          renderItem={({ item }) => (
            <View style={[styles.messageBubbleRow, item.isMine && styles.messageBubbleRowMine]}>
              <View style={[styles.bubble, item.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={item.isMine ? styles.messageTextMine : styles.messageTextTheirs}>
                  {item.content}
                </Text>
                {item.status === "failed" && (
                  <Pressable onPress={() => onRetry(item.id)} style={styles.retryBubble}>
                    <Text style={styles.retryText}>Failed · Tap to retry</Text>
                  </Pressable>
                )}
              </View>
            </View>
          )}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <Text style={styles.mutedText}>No messages yet. Say hello!</Text>
            </View>
          }
        />

        <View style={styles.composer}>
          <TextInput
            multiline
            maxLength={MAX_MESSAGE_LENGTH}
            onChangeText={setInput}
            placeholder="Type a message..."
            placeholderTextColor="#6f776a"
            style={styles.composerInput}
            value={input}
          />
          <View style={styles.composerActions}>
            {showCounter && (
              <Text style={styles.charCounter}>
                {charCount}/{MAX_MESSAGE_LENGTH}
              </Text>
            )}
            <Pressable
              disabled={!input.trim()}
              onPress={handleSend}
              style={[styles.sendButton, !input.trim() && styles.disabledButton]}
            >
              <Text style={styles.sendButtonText}>Send</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
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
  addRow: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  addressError: {
    color: "#ff9f8f",
    fontSize: 12,
    paddingHorizontal: 16,
  },
  avatar: {
    alignItems: "center",
    backgroundColor: "#d4ff62",
    borderRadius: 20,
    height: 40,
    justifyContent: "center",
    width: 40,
  },
  avatarText: {
    color: "#11170f",
    fontSize: 16,
    fontWeight: "900",
  },
  bubble: {
    borderRadius: 16,
    maxWidth: "80%",
    padding: 12,
  },
  bubbleMine: {
    backgroundColor: "#d4ff62",
  },
  bubbleTheirs: {
    backgroundColor: "#11170f",
    borderColor: "#243020",
    borderWidth: 1,
  },
  charCounter: {
    color: "#6f776a",
    fontSize: 11,
    fontWeight: "700",
  },
  chatAddress: {
    color: "#6f776a",
    fontSize: 12,
  },
  chatContainer: {
    flex: 1,
  },
  chatHeader: {
    borderBottomColor: "#1c2618",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  chatTitle: {
    color: "#f4f7ef",
    fontSize: 18,
    fontWeight: "800",
  },
  composer: {
    borderTopColor: "#1c2618",
    borderTopWidth: 1,
    flexDirection: "row",
    gap: 10,
    padding: 12,
  },
  composerActions: {
    alignItems: "flex-end",
    gap: 4,
    justifyContent: "flex-end",
  },
  composerInput: {
    backgroundColor: "#11170f",
    borderColor: "#293322",
    borderRadius: 14,
    borderWidth: 1,
    color: "#f4f7ef",
    flex: 1,
    maxHeight: 100,
    minHeight: 44,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  contactAddress: {
    color: "#6f776a",
    fontSize: 12,
  },
  contactInfo: {
    flex: 1,
  },
  contactLabel: {
    color: "#f4f7ef",
    fontSize: 15,
    fontWeight: "800",
  },
  contactRow: {
    alignItems: "center",
    borderBottomColor: "#1c2618",
    borderBottomWidth: 1,
    flexDirection: "row",
    gap: 12,
    minHeight: 44,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  disabledButton: {
    opacity: 0.4,
  },
  emptyChat: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  emptyMessages: {
    flex: 1,
    justifyContent: "center",
  },
  emptyState: {
    alignItems: "center",
    flex: 1,
    gap: 8,
    justifyContent: "center",
    padding: 24,
  },
  emptyTitle: {
    color: "#f4f7ef",
    fontSize: 18,
    fontWeight: "800",
  },
  errorText: {
    color: "#ff9f8f",
    fontSize: 13,
    lineHeight: 19,
  },
  header: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  initCard: {
    flex: 1,
    gap: 14,
    justifyContent: "center",
    padding: 24,
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
  messageBubbleRow: {
    flexDirection: "row",
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  messageBubbleRowMine: {
    justifyContent: "flex-end",
  },
  messageList: {
    flex: 1,
  },
  messageTextMine: {
    color: "#11170f",
    fontSize: 15,
    lineHeight: 21,
  },
  messageTextTheirs: {
    color: "#f4f7ef",
    fontSize: 15,
    lineHeight: 21,
  },
  mutedText: {
    color: "#aab3a3",
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
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
  retryBubble: {
    marginTop: 6,
  },
  retryText: {
    color: "#ff9f8f",
    fontSize: 11,
    fontWeight: "700",
  },
  screen: {
    flex: 1,
  },
  sendButton: {
    backgroundColor: "#d4ff62",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  sendButtonText: {
    color: "#11170f",
    fontWeight: "900",
  },
  statusBadge: {
    backgroundColor: "#172011",
    borderColor: "#d4ff62",
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    color: "#d4ff62",
    fontSize: 11,
    fontWeight: "800",
  },
  title: {
    color: "#f4f7ef",
    fontSize: 24,
    fontWeight: "900",
  },
});

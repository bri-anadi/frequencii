import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";

const CHAT_INIT_KEY = "frequencii_chat_initialized";
const MAX_MESSAGE_LENGTH = 280;

export interface ChatMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  isMine: boolean;
  status: "sent" | "pending" | "failed";
}

/**
 * MagicBlock P2P Chat hook.
 * 
 * This implements the chat interface and contact-level message management.
 * The actual MagicBlock transaction signer (initialize, delegate, sendMessage)
 * is staged — the hook provides the full UX flow with guarded execution.
 */
export function useMagicBlockChat(walletAddress: string) {
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [messages, setMessages] = useState<Map<string, ChatMessage[]>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check initialization status
  useEffect(() => {
    async function check() {
      const stored = await SecureStore.getItemAsync(CHAT_INIT_KEY);
      setIsInitialized(stored === "true");
    }
    check();
  }, []);

  // Initialize Chat Room PDA (batch: initialize + delegate)
  const initialize = useCallback(async () => {
    setIsInitializing(true);
    setError(null);

    try {
      // TODO: Build batch transaction with MagicBlock_Signer
      // const tx = await magicBlockSigner.buildInitAndDelegateTx(walletAddress);
      // const signature = await mwaSign(tx);
      // await confirmTransaction(signature, 60_000);

      // For now, mark as initialized (guarded)
      await SecureStore.setItemAsync(CHAT_INIT_KEY, "true");
      setIsInitialized(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Initialization failed";
      if (/cancel/i.test(msg)) {
        // User cancelled MWA — silent
      } else if (/timeout/i.test(msg)) {
        setError("Transaction confirmation timed out. Check your wallet and try again.");
      } else {
        setError(msg);
      }
    } finally {
      setIsInitializing(false);
    }
  }, [walletAddress]);

  // Send message to a contact
  const sendMessage = useCallback(
    async (contactAddress: string, content: string) => {
      const trimmed = content.trim();
      if (!trimmed || trimmed.length > MAX_MESSAGE_LENGTH) return;

      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const newMessage: ChatMessage = {
        id: messageId,
        sender: walletAddress,
        content: trimmed,
        timestamp: Date.now(),
        isMine: true,
        status: "pending",
      };

      // Optimistic add
      setMessages((current) => {
        const updated = new Map(current);
        const existing = updated.get(contactAddress) || [];
        updated.set(contactAddress, [...existing, newMessage]);
        return updated;
      });

      try {
        // TODO: Build sendMessage transaction via MagicBlock_Signer
        // If PDA not delegated, add delegateChat instruction first
        // await magicBlockSigner.sendMessage(contactAddress, trimmed);

        // Mark as sent
        setMessages((current) => {
          const updated = new Map(current);
          const existing = updated.get(contactAddress) || [];
          updated.set(
            contactAddress,
            existing.map((m) => (m.id === messageId ? { ...m, status: "sent" as const } : m)),
          );
          return updated;
        });
      } catch {
        // Mark as failed
        setMessages((current) => {
          const updated = new Map(current);
          const existing = updated.get(contactAddress) || [];
          updated.set(
            contactAddress,
            existing.map((m) => (m.id === messageId ? { ...m, status: "failed" as const } : m)),
          );
          return updated;
        });
      }
    },
    [walletAddress],
  );

  // Retry failed message
  const retryMessage = useCallback(
    async (contactAddress: string, messageId: string) => {
      const contactMessages = messages.get(contactAddress) || [];
      const message = contactMessages.find((m) => m.id === messageId);
      if (!message || message.status !== "failed") return;

      // Remove failed message and resend
      setMessages((current) => {
        const updated = new Map(current);
        const existing = updated.get(contactAddress) || [];
        updated.set(
          contactAddress,
          existing.filter((m) => m.id !== messageId),
        );
        return updated;
      });

      await sendMessage(contactAddress, message.content);
    },
    [messages, sendMessage],
  );

  // Start polling for messages from a contact
  const startPolling = useCallback(
    (contactAddress: string) => {
      if (pollRef.current) clearInterval(pollRef.current);

      pollRef.current = setInterval(async () => {
        try {
          // TODO: Poll Chat_Room_PDA via MagicBlock router connection
          // const newMessages = await magicBlockSigner.pollMessages(contactAddress, lastTimestamp);
          // if (newMessages.length > 0) { ... }
        } catch {
          // Silent polling failure
        }
      }, 2000);
    },
    [],
  );

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Cleanup
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const getMessages = useCallback(
    (contactAddress: string) => messages.get(contactAddress) || [],
    [messages],
  );

  return {
    error,
    getMessages,
    initialize,
    isInitialized,
    isInitializing,
    retryMessage,
    sendMessage,
    startPolling,
    stopPolling,
  };
}

export { MAX_MESSAGE_LENGTH };

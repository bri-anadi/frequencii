import { useState, useCallback, useRef } from "react";
import type { AgentMessage, PredictionEvent } from "../types";

/**
 * Detect @agent or @frequant trigger in a message.
 * Returns the query text (everything after the trigger).
 */
export function extractAgentQuery(text: string): string | null {
  const match = text.match(/^@(?:agent|frequant)\s+([\s\S]+)/i);
  return match ? match[1].trim() : null;
}

export function shouldTriggerAgent(text: string): boolean {
  return /^@(?:agent|frequant)\s/i.test(text);
}

export function useAgent() {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string, marketContext: PredictionEvent | null) => {
      // Abort any existing stream
      if (abortRef.current) {
        abortRef.current.abort();
      }

      const userMessage: AgentMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      };

      const agentMessage: AgentMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: "",
        timestamp: new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        isStreaming: true,
      };

      setMessages((prev) => [...prev, userMessage, agentMessage]);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        // Build history from existing messages (exclude the ones we just added)
        const history = messages.map((m) => ({
          role: m.role,
          content: m.content,
        }));

        const response = await fetch("/api/agent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: text,
            marketContext: marketContext || undefined,
            history,
          }),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`Agent error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) throw new Error("No response stream");

        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split("\n");

          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || !trimmed.startsWith("data: ")) continue;

            try {
              const data = JSON.parse(trimmed.slice(6));

              if (data.done) {
                // Stream complete
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMessage.id
                      ? { ...m, content: accumulated, isStreaming: false }
                      : m
                  )
                );
              } else if (data.content) {
                accumulated += data.content;
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === agentMessage.id
                      ? { ...m, content: accumulated }
                      : m
                  )
                );
              }
            } catch {
              // Skip malformed SSE data
            }
          }
        }
      } catch (err: any) {
        if (err.name === "AbortError") return;

        console.error("Agent stream error:", err);

        // Update the agent message with error
        setMessages((prev) =>
          prev.map((m) =>
            m.id === agentMessage.id
              ? {
                  ...m,
                  content:
                    "Sorry, I encountered an error processing your request. Please try again.",
                  isStreaming: false,
                }
              : m
          )
        );
      } finally {
        setIsStreaming(false);
        abortRef.current = null;
      }
    },
    [messages]
  );

  const clearHistory = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setMessages([]);
    setIsStreaming(false);
  }, []);

  const stopStreaming = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
    }
    setIsStreaming(false);
    // Mark last streaming message as complete
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    );
  }, []);

  return {
    messages,
    isStreaming,
    sendMessage,
    clearHistory,
    stopStreaming,
  };
}

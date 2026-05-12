import type { AgentChatRequest, AgentMessage, PredictionEvent } from "@frequencii/shared";
import { Buffer } from "buffer";
import { useCallback, useRef, useState } from "react";
import { API_BASE_URL } from "../../config/env";

type StreamReaderResponse = Response & {
  body?: {
    getReader?: () => {
      read: () => Promise<{ done: boolean; value?: Uint8Array }>;
      releaseLock?: () => void;
    };
  };
};

function createTimestamp() {
  return new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseRelatedMarkets(content: string) {
  const match = content.match(/\|\|MARKETS:(.*?)(?:\|\||$)/);
  const relatedMarketIds = match?.[1]
    ?.split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const displayContent = content.replace(/\|\|MARKETS:?[\s\S]*$/, "").trim();

  return {
    displayContent,
    relatedMarketIds,
  };
}

function parseSseChunk(chunk: string) {
  return chunk
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.startsWith("data: "))
    .map((line) => {
      try {
        return JSON.parse(line.slice(6)) as { content?: string; done?: boolean };
      } catch {
        return null;
      }
    })
    .filter(Boolean) as { content?: string; done?: boolean }[];
}

async function readAgentStream(
  response: StreamReaderResponse,
  onContent: (content: string) => void,
  onDone: () => void,
) {
  const reader = response.body?.getReader?.();

  if (!reader) {
    const text = await response.text();
    for (const event of parseSseChunk(text)) {
      if (event.content) onContent(event.content);
      if (event.done) onDone();
    }
    return;
  }

  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += Buffer.from(value).toString("utf8");
      const parts = buffer.split("\n\n");
      buffer = parts.pop() ?? "";

      for (const part of parts) {
        for (const event of parseSseChunk(part)) {
          if (event.content) onContent(event.content);
          if (event.done) onDone();
        }
      }
    }

    if (buffer) {
      for (const event of parseSseChunk(buffer)) {
        if (event.content) onContent(event.content);
        if (event.done) onDone();
      }
    }
  } finally {
    reader.releaseLock?.();
  }
}

export function useMobileAgent(token: string) {
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const sendMessage = useCallback(
    async (text: string, marketContext?: PredictionEvent | null, trendingMarkets?: PredictionEvent[]) => {
      const trimmed = text.trim();
      if (!trimmed || isStreaming) return;

      abortRef.current?.abort();

      const userMessage: AgentMessage = {
        id: `user-${Date.now()}`,
        role: "user",
        content: trimmed,
        timestamp: createTimestamp(),
      };
      const agentMessage: AgentMessage = {
        id: `agent-${Date.now()}`,
        role: "agent",
        content: "",
        timestamp: createTimestamp(),
        isStreaming: true,
      };
      const history = messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));

      setMessages((current) => [...current, userMessage, agentMessage]);
      setIsStreaming(true);

      const abortController = new AbortController();
      abortRef.current = abortController;

      try {
        const body: AgentChatRequest = {
          history,
          marketContext: marketContext ?? null,
          message: trimmed,
          trendingMarkets: trendingMarkets?.slice(0, 5),
        };

        const response = await fetch(`${API_BASE_URL}/api/v1/agent/chat`, {
          method: "POST",
          headers: {
            Accept: "text/event-stream",
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(errorText || `Agent error: ${response.status}`);
        }

        let accumulated = "";
        const finishMessage = () => {
          const parsed = parseRelatedMarkets(accumulated);
          setMessages((current) =>
            current.map((message) =>
              message.id === agentMessage.id
                ? {
                    ...message,
                    content: parsed.displayContent,
                    isStreaming: false,
                    relatedMarketIds: parsed.relatedMarketIds,
                  }
                : message,
            ),
          );
        };

        await readAgentStream(
          response as StreamReaderResponse,
          (content) => {
            accumulated += content;
            const parsed = parseRelatedMarkets(accumulated);
            setMessages((current) =>
              current.map((message) =>
                message.id === agentMessage.id
                  ? {
                      ...message,
                      content: parsed.displayContent,
                      relatedMarketIds: parsed.relatedMarketIds,
                    }
                  : message,
              ),
            );
          },
          finishMessage,
        );

        finishMessage();
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;

        const message = err instanceof Error ? err.message : "Agent request failed";
        setMessages((current) =>
          current.map((item) =>
            item.id === agentMessage.id
              ? {
                  ...item,
                  content: `I could not complete that analysis. ${message}`,
                  isStreaming: false,
                }
              : item,
          ),
        );
      } finally {
        abortRef.current = null;
        setIsStreaming(false);
      }
    },
    [isStreaming, messages, token],
  );

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
    setMessages((current) =>
      current.map((message) =>
        message.isStreaming ? { ...message, isStreaming: false } : message,
      ),
    );
  }, []);

  const clearHistory = useCallback(() => {
    abortRef.current?.abort();
    setMessages([]);
    setIsStreaming(false);
  }, []);

  return {
    clearHistory,
    isStreaming,
    messages,
    sendMessage,
    stopStreaming,
  };
}

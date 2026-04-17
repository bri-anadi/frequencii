import React, { useRef, useEffect, useState } from "react";
import {
  Column,
  Row,
  Text,
  Button,
  Input,
  Scroller,
} from "@once-ui-system/core";
import type { AgentMessage, PredictionEvent } from "@/lib/types";

interface AgentChatProps {
  messages: AgentMessage[];
  isStreaming: boolean;
  selectedMarket: PredictionEvent | null;
  onSendMessage: (text: string) => void;
  onClearHistory: () => void;
  onStopStreaming: () => void;
}

const QUICK_ACTIONS = [
  { label: "Analyze this market", requiresMarket: true },
  { label: "Top trending markets", requiresMarket: false },
  { label: "Risk assessment", requiresMarket: true },
  { label: "Compare with similar markets", requiresMarket: true },
];

/**
 * Simple markdown-ish rendering: bold, line breaks, bullet points
 */
function renderContent(content: string) {
  if (!content) return null;

  const lines = content.split("\n");
  return lines.map((line, i) => {
    // Bold: **text**
    const formatted = line.replace(
      /\*\*(.*?)\*\*/g,
      '<strong>$1</strong>'
    );

    // Bullet points
    if (line.trim().startsWith("- ") || line.trim().startsWith("* ")) {
      return (
        <div
          key={i}
          style={{ paddingLeft: "16px", marginBottom: "2px" }}
          dangerouslySetInnerHTML={{
            __html: `&bull; ${formatted.replace(/^[\s]*[-*]\s/, "")}`,
          }}
        />
      );
    }

    // Empty lines → spacing
    if (line.trim() === "") {
      return <div key={i} style={{ height: "8px" }} />;
    }

    return (
      <div
        key={i}
        style={{ marginBottom: "2px" }}
        dangerouslySetInnerHTML={{ __html: formatted }}
      />
    );
  });
}

export const AgentChat: React.FC<AgentChatProps> = ({
  messages,
  isStreaming,
  selectedMarket,
  onSendMessage,
  onClearHistory,
  onStopStreaming,
}) => {
  const [inputValue, setInputValue] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    const text = inputValue.trim();
    if (!text || isStreaming) return;
    setInputValue("");
    onSendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    if (isStreaming) return;
    onSendMessage(action);
  };

  return (
    <Column fillWidth fillHeight gap="xs">
      {/* Header */}
      <Row
        fillWidth
        padding="s"
        vertical="center"
        style={{ justifyContent: "space-between" }}
        border="neutral-alpha-medium"
        radius="l"
        background="neutral-weak"
      >
        <Row gap="s" vertical="center">

          <Column>
            <Text variant="label-default-s">Frequencii Agent</Text>
            <Text variant="body-default-xs" onBackground="neutral-weak">
              {selectedMarket
                ? `Analyzing: ${selectedMarket.title.slice(0, 40)}${selectedMarket.title.length > 40 ? "..." : ""}`
                : "Prediction market analyst"}
            </Text>
          </Column>
        </Row>
        <Button
          variant="tertiary"
          size="s"
          onClick={onClearHistory}
        >
          Clear
        </Button>
      </Row>

      {/* Messages */}
      <Column
        ref={scrollRef}
        fillWidth
        flex={1}
        padding="s"
        gap="s"
        border="neutral-alpha-medium"
        radius="l"
        background="neutral-weak"
        style={{ overflowY: "auto", minHeight: "200px" }}
      >
        {messages.length === 0 ? (
          <Column center fillWidth flex={1} gap="m" padding="l">
            <Text variant="heading-strong-m" onBackground="neutral-weak">
              Frequencii Agent
            </Text>
            <Text
              variant="body-default-s"
              onBackground="neutral-weak"
              style={{ textAlign: "center", maxWidth: "360px" }}
            >
              Select a market from the left panel and ask me to analyze it, or
              ask me about trending prediction markets.
            </Text>

            {/* Quick actions for empty state */}
            <Row gap="xs" style={{ flexWrap: "wrap", justifyContent: "center" }}>
              {QUICK_ACTIONS.filter((a) => !a.requiresMarket).map((action) => (
                <Button
                  key={action.label}
                  variant="secondary"
                  size="s"
                  onClick={() => handleQuickAction(action.label)}
                >
                  {action.label}
                </Button>
              ))}
            </Row>
          </Column>
        ) : (
          messages.map((msg) => (
            <Row
              key={msg.id}
              fillWidth
              style={{
                justifyContent:
                  msg.role === "user" ? "flex-end" : "flex-start",
              }}
            >
              <Column
                padding="s"
                radius="l"
                gap="4"
                style={{
                  maxWidth: "80%",
                  background:
                    msg.role === "user"
                      ? "var(--brand-solid-strong)"
                      : "var(--neutral-alpha-weak)",
                }}
              >
                <Text
                  variant="body-default-s"
                  style={{
                    color:
                      msg.role === "user"
                        ? "var(--neutral-on-solid-strong)"
                        : "var(--neutral-on-surface-strong)",
                    lineHeight: "1.5",
                  }}
                >
                  {msg.role === "agent" ? (
                    <>{renderContent(msg.content)}</>
                  ) : (
                    msg.content
                  )}
                  {msg.isStreaming && (
                    <span
                      style={{
                        display: "inline-block",
                        width: "8px",
                        height: "16px",
                        background: "var(--brand-solid-strong)",
                        marginLeft: "2px",
                        animation: "blink 1s infinite",
                      }}
                    />
                  )}
                </Text>
                <Text
                  variant="body-default-xs"
                  style={{
                    opacity: 0.5,
                    color:
                      msg.role === "user"
                        ? "var(--neutral-on-solid-strong)"
                        : "var(--neutral-on-surface-weak)",
                  }}
                >
                  {msg.timestamp}
                </Text>
              </Column>
            </Row>
          ))
        )}
      </Column>

      {/* Quick actions when market is selected */}
      {selectedMarket && messages.length > 0 && !isStreaming && (
        <Row gap="xs" paddingX="xs" style={{ flexWrap: "wrap" }}>
          {QUICK_ACTIONS.filter((a) => a.requiresMarket).map((action) => (
            <Button
              key={action.label}
              variant="tertiary"
              size="s"
              onClick={() => handleQuickAction(action.label)}
            >
              {action.label}
            </Button>
          ))}
        </Row>
      )}

      {/* Input bar */}
      <Row
        fillWidth
        gap="xs"
        padding="xs"
        border="neutral-alpha-medium"
        radius="l"
        background="neutral-weak"
        vertical="center"
      >
        <Input
          id="agent-input"
          ref={inputRef}
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            selectedMarket
              ? `Ask about "${selectedMarket.title.slice(0, 30)}..."`
              : "Ask about prediction markets..."
          }
          height="s"
          style={{ flex: 1 }}
          disabled={isStreaming}
        />
        {isStreaming ? (
          <Button
            variant="danger"
            size="s"
            onClick={onStopStreaming}
          >
            Stop
          </Button>
        ) : (
          <Button
            variant="primary"
            size="s"
            onClick={handleSend}
            disabled={!inputValue.trim()}
          >
            Send
          </Button>
        )}
      </Row>

      {/* Blinking cursor animation */}
      <style>{`
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      `}</style>
    </Column>
  );
};

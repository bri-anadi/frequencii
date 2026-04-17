import React, { useRef, useEffect, useState } from "react";
import {
    Flex,
    Column,
    Row,
    Text,
    Input,
    Button,
    IconButton,
    Scroller,
} from "@once-ui-system/core";
import { formatContactName } from "@/lib/chatUtils";
import type { UnifiedMessage, PredictionEvent } from "@/lib/types";

interface UnifiedChatWindowProps {
    isMobile: boolean;
    roomType: "frequant" | "contact";
    roomName: string;
    messages: UnifiedMessage[];
    isAgentStreaming: boolean;
    selectedMarket: PredictionEvent | null;
    onSendMessage: (text: string) => void;
    onBack: () => void;
    onOpenGiftModal: () => void;
    onStopStreaming: () => void;
    onClearHistory: () => void;
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

        // Empty lines -> spacing
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



export const UnifiedChatWindow: React.FC<UnifiedChatWindowProps> = ({
    isMobile,
    roomType,
    roomName,
    messages,
    isAgentStreaming,
    selectedMarket,
    onSendMessage,
    onBack,
    onOpenGiftModal,
    onStopStreaming,
    onClearHistory,
}) => {
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = () => {
        const text = inputValue.trim();
        if (!text) return;
        if (isAgentStreaming) return;
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
        if (isAgentStreaming) return;
        onSendMessage(action);
    };

    const isFrequant = roomType === "frequant";

    return (
        <Column
            fillWidth
            border="neutral-alpha-medium"
            radius="l"
            background="surface"
            overflow="hidden"
        >
            {/* Header */}
            <Row
                fillWidth
                padding="m"
                borderBottom="neutral-alpha-medium"
                vertical="center"
                gap="s"
                background="neutral-weak"
            >
                {isMobile && (
                    <IconButton
                        icon="chevronLeft"
                        variant="tertiary"
                        onClick={onBack}
                        tooltip="Back"
                    />
                )}
                <Column fillWidth>
                    <Text variant="heading-strong-s">
                        {isFrequant ? "Frequant" : formatContactName(roomName)}
                    </Text>
                    <Text variant="label-default-xs" onBackground="neutral-weak">
                        {isFrequant
                            ? (selectedMarket
                                ? `Analyzing: ${selectedMarket.title.slice(0, 40)}${selectedMarket.title.length > 40 ? "..." : ""}`
                                : "AI Prediction Agent")
                            : "On-chain"
                        }
                    </Text>
                </Column>
                {isFrequant && (
                    <Button variant="tertiary" size="s" onClick={onClearHistory}>
                        Clear
                    </Button>
                )}
            </Row>

            {/* Messages */}
            <Column fillWidth fillHeight overflow="hidden" position="relative" background="neutral-weak">
                <Scroller fillWidth fillHeight padding="m">
                    <Column gap="m" fillWidth>
                        {messages.length === 0 && isFrequant ? (
                            <Column center fillWidth flex={1} gap="m" padding="l">
                                <Text variant="heading-strong-m" onBackground="neutral-weak">
                                    Frequant
                                </Text>
                                <Text
                                    variant="body-default-s"
                                    onBackground="neutral-weak"
                                    style={{ textAlign: "center", maxWidth: "360px" }}
                                >
                                    Ask me about prediction markets, or select a market from the right panel.
                                </Text>
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
                        ) : messages.length === 0 && !isFrequant ? (
                            <Column center fillWidth flex={1} gap="m" padding="l">
                                <Text variant="heading-strong-m" onBackground="neutral-weak">
                                    Start a conversation
                                </Text>
                                <Text variant="body-default-s" onBackground="neutral-weak" style={{ textAlign: "center" }}>
                                    Messages are sent on-chain via MagicBlock. Type @agent to invoke Frequant.
                                </Text>
                            </Column>
                        ) : (
                            messages.map((msg) => {
                                const isMine = msg.sender === "me";
                                const isAgent = msg.sender === "frequant" || msg.type === "agent";
                                const isGift = msg.type === "gift";

                                return (
                                    <Flex
                                        key={msg.id}
                                        fillWidth
                                        horizontal={isMine ? "end" : "start"}
                                    >
                                        {isGift ? (
                                            <Column
                                                fit
                                                padding="m"
                                                radius="l"
                                                background="brand-medium"
                                                style={{
                                                    maxWidth: "60%",
                                                    borderBottomRightRadius: isMine ? "4px" : "var(--radius-l)",
                                                    borderBottomLeftRadius: isMine ? "var(--radius-l)" : "4px"
                                                }}
                                                gap="xs"
                                            >
                                                <Row vertical="center" gap="s">
                                                    <Column>
                                                        <Text variant="heading-strong-m" onBackground="brand-strong">
                                                            {msg.amount} {msg.token}
                                                        </Text>
                                                        {msg.txHash && (
                                                            <a
                                                                href={`https://solscan.io/tx/${msg.txHash}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                style={{ textDecoration: 'none' }}
                                                            >
                                                                <Text variant="body-default-xs" onBackground="brand-medium" style={{ opacity: 0.7, wordBreak: 'break-all', cursor: 'pointer' }}>
                                                                    {msg.txHash.substring(0, 8)}...{msg.txHash.substring(msg.txHash.length - 8)}
                                                                </Text>
                                                            </a>
                                                        )}
                                                    </Column>
                                                </Row>
                                                <Text variant="label-default-xs" onBackground="brand-weak" style={{ alignSelf: "flex-end" }}>
                                                    {msg.timestamp}
                                                </Text>
                                            </Column>
                                        ) : isAgent ? (
                                            <Row gap="xs" style={{ maxWidth: "80%" }}>
                                                <Column
                                                    padding="s"
                                                    radius="l"
                                                    gap="4"
                                                    style={{
                                                        background: "var(--neutral-alpha-weak)",
                                                        borderBottomLeftRadius: "4px",
                                                    }}
                                                >
                                                    <Text
                                                        variant="body-default-s"
                                                        style={{ lineHeight: "1.5" }}
                                                    >
                                                        {renderContent(msg.content)}
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
                                                    <Text variant="body-default-xs" style={{ opacity: 0.5 }}>
                                                        {msg.timestamp}
                                                    </Text>
                                                </Column>
                                            </Row>
                                        ) : (
                                            <Column
                                                fit
                                                padding="s"
                                                radius="l"
                                                background={isMine ? "brand-medium" : "neutral-medium"}
                                                style={{
                                                    maxWidth: "60%",
                                                    borderBottomRightRadius: isMine ? "4px" : "var(--radius-l)",
                                                    borderBottomLeftRadius: isMine ? "var(--radius-l)" : "4px"
                                                }}
                                            >
                                                <Text variant="body-default-s">{msg.content}</Text>
                                                <Text variant="label-default-xs" onBackground="neutral-weak" style={{ marginTop: "4px", alignSelf: "flex-end" }}>
                                                    {msg.timestamp}
                                                </Text>
                                            </Column>
                                        )}
                                    </Flex>
                                );
                            })
                        )}
                        <div ref={messagesEndRef} />
                    </Column>
                </Scroller>
            </Column>

            {/* Quick actions when market is selected in Frequant room */}
            {isFrequant && selectedMarket && messages.length > 0 && !isAgentStreaming && (
                <Row gap="xs" paddingX="s" paddingY="xs" style={{ flexWrap: "wrap" }}>
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

            {/* Input Area */}
            <Row
                fillWidth
                padding="m"
                gap="s"
                borderTop="neutral-alpha-medium"
                background="neutral-weak"
                vertical="center"
            >
                {!isFrequant && (
                    <Button
                        variant="secondary"
                        prefixIcon="rocket"
                        size="l"
                        onClick={onOpenGiftModal}
                    />
                )}
                <Input
                    id="unified-chat-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    height="s"
                    placeholder={
                        isFrequant
                            ? (selectedMarket
                                ? `Ask about "${selectedMarket.title.slice(0, 30)}..."`
                                : "Ask about prediction markets...")
                            : "Type a message... (@agent for AI)"
                    }
                    disabled={isAgentStreaming}
                />
                {isAgentStreaming ? (
                    <Button variant="danger" size="s" onClick={onStopStreaming}>
                        Stop
                    </Button>
                ) : (
                    <Button
                        size="l"
                        variant="primary"
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

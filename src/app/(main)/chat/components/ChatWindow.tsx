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
    Icon,
} from "@once-ui-system/core";
import { formatContactName } from "../utils";

interface ChatWindowProps {
    isMobile: boolean;
    selectedContact: any;
    messages: any[];
    onSendMessage: (text: string) => void;
    onBack: () => void;
    onOpenGiftModal: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
    isMobile,
    selectedContact,
    messages,
    onSendMessage,
    onBack,
    onOpenGiftModal,
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
        if (!inputValue.trim()) return;
        onSendMessage(inputValue);
        setInputValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSend();
        }
    };

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
                        tooltip="Back to chats"
                    />
                )}
                <Column fillWidth>
                    <Text variant="heading-strong-s">{formatContactName(selectedContact.name)}</Text>
                    <Text variant="label-default-xs" onBackground="neutral-weak">On-chain</Text>
                </Column>
            </Row>

            {/* Messages */}
            <Column fillWidth fillHeight overflow="hidden" position="relative" background="neutral-weak">
                <Scroller fillWidth fillHeight padding="m">
                    <Column gap="m" fillWidth>
                        {messages.map((msg: any) => (
                            <Flex
                                key={msg.id}
                                fillWidth
                                horizontal={msg.sender === "me" ? "end" : "start"}
                            >
                                {msg.type === 'gift' ? (
                                    <Column
                                        fit
                                        padding="m"
                                        radius="l"
                                        background="brand-medium"
                                        style={{
                                            maxWidth: "60%",
                                            borderBottomRightRadius: msg.sender === "me" ? "4px" : "var(--radius-l)",
                                            borderBottomLeftRadius: msg.sender === "me" ? "var(--radius-l)" : "4px"
                                        }}
                                        gap="xs"
                                    >
                                        <Row vertical="center" gap="s">
                                            <Icon name="rocket" size="s" />
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
                                ) : (
                                    <Column
                                        fit
                                        padding="s"
                                        radius="l"
                                        background={msg.sender === "me" ? "brand-medium" : "neutral-medium"}
                                        style={{
                                            maxWidth: "60%",
                                            borderBottomRightRadius: msg.sender === "me" ? "4px" : "var(--radius-l)",
                                            borderBottomLeftRadius: msg.sender === "me" ? "var(--radius-l)" : "4px"
                                        }}
                                    >
                                        <Text variant="body-default-s">{msg.text}</Text>
                                        <Text variant="label-default-xs" onBackground="neutral-weak" style={{ marginTop: "4px", alignSelf: "flex-end" }}>
                                            {msg.timestamp}
                                        </Text>
                                    </Column>
                                )}
                            </Flex>
                        ))}
                        <div ref={messagesEndRef} />
                    </Column>
                </Scroller>
            </Column>

            {/* Input Area */}
            <Row
                fillWidth
                padding="m"
                gap="s"
                borderTop="neutral-alpha-medium"
                background="neutral-weak"
                vertical="center"
            >
                <Button
                    variant="secondary"
                    prefixIcon="rocket"
                    size="l"
                    onClick={onOpenGiftModal}
                />
                <Input
                    id="chat-input"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    height="s"
                    placeholder="Type a message..."
                />
                <Button
                    size="l"
                    variant="primary"
                    onClick={handleSend}
                    disabled={!inputValue.trim()}
                >
                    Send
                </Button>
            </Row>
        </Column>
    );
};

"use client";

import React, { useState, useRef, useEffect } from "react";
import { z } from "zod";
import {
    Flex,
    Column,
    Row,
    Text,

    Input,
    Button,
    IconButton,
    Scroller,
    StatusIndicator,
    NumberInput,
    Icon,
} from "@once-ui-system/core";
import { useAppKit, useAppKitAccount } from '@reown/appkit/react';
// import { WalletSelectModal } from '@/components/WalletSelectModal'; // Removed

// Mock Data
const MOCK_CONTACTS = [
    { id: "1", name: "Alice", avatar: "", status: "green", lastMessage: "Hey, are you there?" },
    { id: "2", name: "Bob", avatar: "", status: "gray", lastMessage: "See you later!" },
    { id: "3", name: "Charlie", avatar: "", status: "yellow", lastMessage: "Processing payment..." },
];

const MOCK_MESSAGES = [
    { id: "1", sender: "other", text: "Hello! Is the content encrypted?", timestamp: "10:00 AM" },
    { id: "2", sender: "me", text: "Yes, fully end-to-end encrypted via IPFS.", timestamp: "10:01 AM" },
    { id: "3", sender: "other", text: "Awesome. How about payments?", timestamp: "10:02 AM" },
    { id: "4", sender: "me", text: "Native SOL and SPL tokens supported.", timestamp: "10:03 AM" },
    { id: "5", sender: "other", text: "That sounds great for creators!", timestamp: "10:04 AM" },
    { id: "6", sender: "me", text: "Exactly! And zero platform fees for P2P interactions.", timestamp: "10:05 AM" },
    { id: "7", sender: "other", text: "When is the launch?", timestamp: "10:06 AM" },
    { id: "8", sender: "me", text: "We are aiming for Q3 2024. Just finalizing the audit.", timestamp: "10:07 AM" },
    { id: "9", sender: "other", text: "Can I be a beta tester?", timestamp: "10:08 AM" },
    { id: "10", sender: "me", text: "Sure thing! I'll send you the invite link shortly.", timestamp: "10:09 AM" },
];

const contactSchema = z.string().min(32, "Address is too short").max(44, "Address is too long");
const giftSchema = z.string().regex(/^\d+(\.\d+)?$/, "Invalid amount").refine(val => Number(val) > 0, "Amount must be greater than 0");

const formatContactName = (name: string) => {
    if (name.length > 16) {
        return `${name.slice(0, 6)}...${name.slice(-4)}`;
    }
    return name;
};

export default function ChatPage() {
    const [selectedContact, setSelectedContact] = useState(MOCK_CONTACTS[0]);
    const [messages, setMessages] = useState(MOCK_MESSAGES);
    const [inputValue, setInputValue] = useState("");
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSendMessage = () => {
        if (!inputValue.trim()) return;

        const newMessage = {
            id: Date.now().toString(),
            sender: "me",
            text: inputValue,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages([...messages, newMessage]);
        setInputValue("");
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
            handleSendMessage();
        }
    };

    const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
    const [giftAmount, setGiftAmount] = useState("");
    const [giftToken, setGiftToken] = useState("SOL");
    const [giftError, setGiftError] = useState("");

    const handleSendGift = () => {
        const result = giftSchema.safeParse(giftAmount);

        if (!result.success) {
            setGiftError(result.error.issues[0].message);
            return;
        }

        const newMessage = {
            id: Date.now().toString(),
            sender: "me",
            type: "gift",
            amount: giftAmount,
            token: giftToken,
            txHash: Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
            text: `Sent a Crypto Gift: ${giftAmount} ${giftToken}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages([...messages, newMessage]);
        setIsGiftModalOpen(false);
        setGiftAmount("");
        setGiftError("");
    };

    const { open } = useAppKit();
    const { address, isConnected } = useAppKitAccount();
    const publicKey = address ? { toBase58: () => address } : null; // Adapter compatibility
    const isWalletConnected = isConnected;
    const [isMobile, setIsMobile] = useState(false);
    const [showChat, setShowChat] = useState(false);

    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);



    const handleContactClick = (contact: any) => {
        setSelectedContact(contact);
        setShowChat(true);
    };

    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [newContactAddress, setNewContactAddress] = useState("");
    const [addContactError, setAddContactError] = useState("");
    const [contacts, setContacts] = useState(MOCK_CONTACTS);

    const handleAddContact = () => {
        const result = contactSchema.safeParse(newContactAddress);

        if (!result.success) {
            setAddContactError(result.error.issues[0].message);
            return;
        }

        const newContact = {
            id: Date.now().toString(),
            name: newContactAddress, // Using address as name for now
            avatar: "",
            status: "gray",
            lastMessage: "New contact added",
        };

        setContacts([...contacts, newContact]);
        setNewContactAddress("");
        setAddContactError("");
        setIsAddContactModalOpen(false);
        setSelectedContact(newContact);
    };

    const [searchQuery, setSearchQuery] = useState("");

    const filteredContacts = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <>
            <Flex fillWidth style={{ height: "calc(100vh)" }} padding="m" gap="m">
                {/* Sidebar */}
                {(!isMobile || !showChat) && (
                    <Column
                        fillWidth={isMobile}
                        style={!isMobile ? { maxWidth: '300px', minWidth: '300px' } : {}}
                        border="neutral-alpha-medium"
                        radius="l"
                        background="neutral-weak"
                        padding="s"
                        gap="xs"
                        fillHeight={true}
                    >
                        <Text variant="heading-strong-s" padding="s" marginBottom="xs">
                            Frequencii
                        </Text>

                        <Column paddingBottom="s">
                            <Input
                                id="contact-search"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search contacts..."
                                height="s"
                            />
                        </Column>

                        <Scroller fillWidth>
                            <Column gap="4" fillWidth>
                                {filteredContacts.map((contact) => (
                                    <Button
                                        key={contact.id}
                                        variant={selectedContact.id === contact.id ? "secondary" : "tertiary"}
                                        onClick={() => handleContactClick(contact)}
                                        fillWidth
                                        style={{ justifyContent: 'flex-start', height: 'auto' }}
                                    >
                                        <Row fillWidth gap="s" vertical="center" paddingY="4">
                                            <Column fillWidth gap="4">
                                                <Row fillWidth vertical="center" gap="4">
                                                    <StatusIndicator color={contact.status as "green" | "gray" | "yellow" | "red"} />
                                                    <Text variant="label-default-s">{formatContactName(contact.name)}</Text>
                                                </Row>
                                                <Text variant="body-default-xs" onBackground="neutral-weak" truncate>
                                                    {contact.lastMessage}
                                                </Text>
                                            </Column>
                                        </Row>
                                    </Button>
                                ))}
                            </Column>
                        </Scroller>

                        <Column gap="xs" style={{ marginTop: 'auto' }}>
                            {isWalletConnected && (
                                <Button
                                    fillWidth
                                    variant="primary"
                                    prefixIcon="plus"
                                    onClick={() => setIsAddContactModalOpen(true)}
                                >
                                    Add Contact
                                </Button>
                            )}
                            <Button
                                fillWidth
                                variant={isWalletConnected ? "secondary" : "primary"}
                                onClick={() => {
                                    if (isWalletConnected) {
                                        // Reown handles disconnect via the modal or we can use disconnect() from hook if available
                                        open();
                                    } else {
                                        open();
                                    }
                                }}
                            >
                                {isWalletConnected && publicKey
                                    ? formatContactName(publicKey.toBase58())
                                    : "Connect Wallet"}
                            </Button>
                        </Column>
                    </Column>
                )}

                {/* Main Chat Area */}
                {(!isMobile || showChat) && (
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
                                    onClick={() => setShowChat(false)}
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
                                onClick={() => setIsGiftModalOpen(true)}
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
                                onClick={handleSendMessage}
                                disabled={!inputValue.trim()}
                            >
                                Send
                            </Button>
                        </Row>
                    </Column>
                )}
            </Flex>

            {/* Crypto Gift Modal */}
            {isGiftModalOpen && (
                <Flex
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000,
                        backdropFilter: 'blur(4px)',
                    }}
                    center
                    vertical="center"
                    horizontal="center"
                >
                    <Column
                        background="surface"
                        padding="l"
                        radius="l"
                        border="neutral-alpha-weak"
                        gap="l"
                        style={{ width: '400px', maxWidth: '90vw' }}
                    >
                        <Text variant="heading-strong-m">Send Crypto Gift</Text>

                        <Column gap="s">
                            <Text variant="label-default-s">Amount</Text>
                            <NumberInput
                                id="gift-amount"
                                value={Number(giftAmount)}
                                onChange={(value: number) => {
                                    const valStr = String(value);
                                    setGiftAmount(valStr);
                                    const result = giftSchema.safeParse(valStr);
                                    if (!result.success) {
                                        setGiftError(result.error.issues[0].message);
                                    } else {
                                        setGiftError("");
                                    }
                                }}
                                placeholder="0.00"
                            />
                            {giftError && (
                                <Text variant="label-default-s" onBackground="danger-weak" style={{ color: 'var(--danger-on-background-weak)' }}>
                                    {giftError}
                                </Text>
                            )}
                        </Column>

                        <Column gap="s">
                            <Text variant="label-default-s">Token</Text>
                            <Row gap="s">
                                {['SOL', 'USDC', 'USDT'].map(token => (
                                    <Button
                                        key={token}
                                        variant={giftToken === token ? 'primary' : 'secondary'}
                                        onClick={() => setGiftToken(token)}
                                        fillWidth
                                    >
                                        {token}
                                    </Button>
                                ))}
                            </Row>
                        </Column>

                        <Row gap="s" style={{ justifyContent: 'flex-end' }}>
                            <Button variant="secondary" onClick={() => setIsGiftModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={handleSendGift} disabled={!giftAmount}>
                                Send Gift
                            </Button>
                        </Row>
                    </Column>
                </Flex>
            )}

            {/* Add Contact Modal */}
            {isAddContactModalOpen && (
                <Flex
                    style={{
                        position: 'fixed',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor: 'rgba(0, 0, 0, 0.5)',
                        zIndex: 1000,
                        backdropFilter: 'blur(4px)',
                    }}
                    center
                    vertical="center"
                    horizontal="center"
                >
                    <Column
                        background="surface"
                        padding="l"
                        radius="l"
                        border="neutral-alpha-weak"
                        gap="l"
                        style={{ width: '400px', maxWidth: '90vw' }}
                    >
                        <Text variant="heading-strong-m">Add New Contact</Text>

                        <Column gap="s">
                            <Input
                                id="contact-address"
                                value={newContactAddress}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setNewContactAddress(value);
                                    const result = contactSchema.safeParse(value);
                                    if (!result.success) {
                                        setAddContactError(result.error.issues[0].message);
                                    } else {
                                        setAddContactError("");
                                    }
                                }}
                                placeholder="Enter wallet address..."
                            />
                            {addContactError && (
                                <Text variant="label-default-s" onBackground="danger-weak" style={{ color: 'var(--danger-on-background-weak)' }}>
                                    {addContactError}
                                </Text>
                            )}
                        </Column>

                        <Row gap="s" style={{ justifyContent: 'flex-end' }}>
                            <Button variant="secondary" onClick={() => setIsAddContactModalOpen(false)}>
                                Cancel
                            </Button>
                            <Button variant="primary" onClick={handleAddContact} disabled={!newContactAddress.trim()}>
                                Add Contact
                            </Button>
                        </Row>
                    </Column>
                </Flex>
            )}
        </>
    );
}

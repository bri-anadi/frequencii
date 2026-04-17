"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    Flex,
    Text,
    Column,
    Row,
    Button,
    Badge,
    LetterFx,
    Heading,
} from "@once-ui-system/core";
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react';

// Shared hooks
import { useChatRollup } from '@/lib/hooks/useChatRollup';
import { useChatListener, ChatMessageEvent } from '@/lib/hooks/useChatListener';
import { useAgent, shouldTriggerAgent, extractAgentQuery } from '@/lib/hooks/useAgent';
import { useMarkets } from '@/lib/hooks/useMarkets';
import { useBurnerWallet } from '@/lib/hooks/useBurnerWallet';
import { useJupiterPredict } from '@/lib/hooks/useJupiterPredict';

// Shared types
import type { UnifiedMessage, PredictionEvent } from '@/lib/types';

// Components
import { UnifiedSidebar } from './components/UnifiedSidebar';
import { UnifiedChatWindow } from './components/UnifiedChatWindow';
import { MarketPanel } from './components/MarketPanel';
import { GiftModal } from './components/GiftModal';
import { AddContactModal } from './components/AddContactModal';

export default function Home() {
    // ============= App State =============
    const [isMounted, setIsMounted] = useState(false);
    const [messages, setMessages] = useState<UnifiedMessage[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedRoom, setSelectedRoom] = useState<string | null>("frequant");

    // UI State
    const [isMobile, setIsMobile] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [showMarketPanel, setShowMarketPanel] = useState(false);
    const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);

    // ============= Wallet =============
    const { open } = useAppKit();
    const { address, isConnected } = useAppKitAccount();
    const { disconnect } = useDisconnect();

    // ============= Hooks =============
    const rollup = useChatRollup();

    // AI Agent
    const agent = useAgent();

    // Markets
    const marketsHook = useMarkets();

    // Burner Wallet
    const burner = useBurnerWallet();

    // Jupiter Predict
    const jupiter = useJupiterPredict({
        signTransaction: burner.signTransaction,
        burnerPublicKey: burner.publicKey,
    });

    // ============= Persistence =============
    useEffect(() => {
        setIsMounted(true);
        if (typeof window !== 'undefined') {
            const savedContacts = localStorage.getItem('frequencii_contacts');
            if (savedContacts) {
                try {
                    setContacts(JSON.parse(savedContacts));
                } catch (e) { console.error("Failed to load contacts", e); }
            }
        }
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined' && contacts.length > 0) {
            localStorage.setItem('frequencii_contacts', JSON.stringify(contacts));
        }
    }, [contacts]);

    // ============= Responsive =============
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // ============= Derived State =============
    const isFrequantRoom = selectedRoom === "frequant";
    const selectedContact = contacts.find(c => c.id === selectedRoom) || null;
    const roomName = isFrequantRoom ? "Frequant" : (selectedContact?.name || "");

    // Market panel visibility: always in frequant room, hidden in contact rooms unless toggled
    const isMarketPanelVisible = isFrequantRoom || showMarketPanel;

    // ============= Chat Listener =============
    const handleIncomingMessage = useCallback((event: ChatMessageEvent) => {
        const senderStr = event.sender.toBase58();
        if (senderStr === address) return;

        const newMessage: UnifiedMessage = {
            id: `${senderStr}-${event.timestamp}-${Math.random()}`,
            sender: senderStr,
            content: event.content,
            timestamp: new Date(event.timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: "user",
        };

        setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) return prev;
            return [...prev, newMessage];
        });
    }, [address]);

    useChatListener(contacts, handleIncomingMessage);

    // ============= Agent Messages -> UnifiedMessage Sync =============
    // Convert agent.messages to UnifiedMessage format for Frequant room
    const frequantMessages: UnifiedMessage[] = agent.messages.map(m => ({
        id: m.id,
        sender: m.role === "user" ? "me" : "frequant",
        content: m.content,
        timestamp: m.timestamp,
        type: m.role === "user" ? "user" : "agent",
        isStreaming: m.isStreaming,
        relatedMarketIds: m.relatedMarketIds,
    }));

    // ============= Handlers =============
    const handleRoomSelect = (roomId: string) => {
        setSelectedRoom(roomId);
        setShowChat(true);
        setShowMarketPanel(false); // Reset panel toggle for contact rooms
    };

    const handleSendMessage = async (text: string) => {
        if (isFrequantRoom) {
            // In Frequant room: all messages go to AI agent
            await agent.sendMessage(text, marketsHook.selectedMarket, marketsHook.markets);
            return;
        }

        // In a contact room: check for @agent trigger
        if (shouldTriggerAgent(text)) {
            const query = extractAgentQuery(text);
            if (query) {
                // Show the user message in the chat
                const userMsg: UnifiedMessage = {
                    id: `user-${Date.now()}`,
                    sender: "me",
                    content: text,
                    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                    type: "user",
                };
                setMessages(prev => [...prev, userMsg]);

                // Send to agent and inject response
                await agent.sendMessage(query, marketsHook.selectedMarket, marketsHook.markets);

                // Show market panel when agent is triggered
                setShowMarketPanel(true);
            }
            return;
        }

        // Regular P2P message
        const newMessage: UnifiedMessage = {
            id: Date.now().toString(),
            sender: "me",
            content: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: "user",
        };
        setMessages(prev => [...prev, newMessage]);

        if (isConnected) {
            try {
                await rollup.sendMessage(text);
            } catch (e) {
                console.error("Failed to send P2P message", e);
            }
        }
    };

    const handleSendGift = (amount: string, token: string) => {
        const newMessage: UnifiedMessage = {
            id: Date.now().toString(),
            sender: "me",
            content: `Sent a Crypto Gift: ${amount} ${token}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            type: "gift",
            amount: amount,
            token: token,
            txHash: Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        };
        setMessages(prev => [...prev, newMessage]);
        setIsGiftModalOpen(false);
    };

    const handleAddContact = async (newAddress: string) => {
        const newContact = {
            id: Date.now().toString(),
            name: newAddress,
            avatar: "",
            status: "gray",
            lastMessage: "New contact added",
        };
        setContacts(prev => [...prev, newContact]);
        setIsAddContactModalOpen(false);

        if (!selectedRoom || selectedRoom === "frequant") {
            setSelectedRoom(newContact.id);
        }

        if (isConnected) {
            try {
                await rollup.delegate();
            } catch (e) {
                console.warn("Auto-delegation failed:", e);
            }
        }
    };

    // ============= Current room messages =============
    const currentMessages: UnifiedMessage[] = isFrequantRoom
        ? frequantMessages
        : messages;

    // ============= Wallet Gate =============
    if (!isMounted) return null;

    if (!isConnected) {
        return (
            <Column fillWidth center padding="l" style={{ minHeight: "100vh" }}>
                <Column maxWidth="s" horizontal="center" gap="l" align="center">
                    <Badge
                        textVariant="code-default-s"
                        border="neutral-alpha-medium"
                        onBackground="neutral-medium"
                        vertical="center"
                        gap="16"
                    >
                        <Text marginX="4">
                            <LetterFx trigger="instant">frequencii.world</LetterFx>
                        </Text>
                    </Badge>
                    <Heading variant="display-strong-xl" marginTop="24">
                        Connect on Your Frequency
                    </Heading>
                    <Text
                        variant="heading-default-xl"
                        onBackground="neutral-weak"
                        wrap="balance"
                        marginBottom="16"
                    >
                        Unstoppable, serverless messaging powered by Solana. Chat freely, predict privately.
                    </Text>

                    {/* Feature cards removed per request */}

                    <Button
                        id="connect-wallet"
                        variant="primary"
                        data-border="rounded"
                        onClick={() => open()}
                        arrowIcon
                    >
                        Connect Wallet
                    </Button>
                </Column>
            </Column>
        );
    }

    // ============= Main Unified Layout =============
    return (
        <>
            <Flex fillWidth style={{ height: "100vh" }} padding="m" gap="m">
                {/* LEFT: Sidebar */}
                {(!isMobile || !showChat) && (
                    <UnifiedSidebar
                        isMobile={isMobile}
                        contacts={contacts}
                        selectedRoom={selectedRoom}
                        onRoomSelect={handleRoomSelect}
                        isWalletConnected={isConnected}
                        onOpenAddContact={() => setIsAddContactModalOpen(true)}
                        onConnectWallet={open}
                        publicKeyString={address}
                        onDelegate={async () => {
                            try {
                                await rollup.delegate();
                            } catch (e) {
                                console.error(e);
                            }
                        }}
                        onUndelegate={async () => {
                            try {
                                await rollup.undelegate();
                            } catch (e) {
                                console.error(e);
                            }
                        }}
                    />
                )}

                {/* CENTER: Chat Window */}
                {(!isMobile || showChat) && (
                    <UnifiedChatWindow
                        isMobile={isMobile}
                        roomType={isFrequantRoom ? "frequant" : "contact"}
                        roomName={roomName}
                        messages={currentMessages}
                        isAgentStreaming={agent.isStreaming}
                        selectedMarket={marketsHook.selectedMarket}
                        trendingMarkets={marketsHook.markets.slice(0, 3)}
                        onMarketSelect={marketsHook.selectMarket}
                        onSendMessage={handleSendMessage}
                        onBack={() => setShowChat(false)}
                        onOpenGiftModal={() => setIsGiftModalOpen(true)}
                        onStopStreaming={agent.stopStreaming}
                        onClearHistory={agent.clearHistory}
                    />
                )}

                {/* RIGHT: Market Panel */}
                {(!isMobile || !showChat) && (
                    <MarketPanel
                        visible={isMarketPanelVisible}
                        isMobile={isMobile}
                        // Markets
                        markets={marketsHook.markets}
                        selectedMarket={marketsHook.selectedMarket}
                        isLoadingMarkets={marketsHook.isLoading}
                        hasMoreMarkets={marketsHook.hasMore}
                        activeCategory={marketsHook.filters.category}
                        onSelectMarket={marketsHook.selectMarket}
                        onCategoryChange={marketsHook.updateCategory}
                        onSearchChange={marketsHook.updateSearch}
                        onRefreshMarkets={marketsHook.refetch}
                        onLoadMoreMarkets={marketsHook.loadMore}
                        // Burner wallet
                        burnerIsSetup={burner.isSetup}
                        burnerIsUnlocked={burner.isUnlocked}
                        burnerPublicKey={burner.publicKey}
                        burnerBalanceSol={burner.balanceSol}
                        burnerStep={burner.step}
                        burnerStepMessage={burner.stepMessage}
                        burnerError={burner.error}
                        privacyCashSigned={burner.privacyCashSigned}
                        onSetupBurner={burner.setupBurnerWallet}
                        onUnlockBurner={burner.unlockBurnerWallet}
                        onFundBurner={burner.fundBurnerWallet}
                        onResetBurner={burner.resetBurnerWallet}
                        // Trade
                        tradeStep={jupiter.tradeStep}
                        tradeMessage={jupiter.tradeMessage}
                        tradeError={jupiter.error}
                        isTrading={jupiter.isTrading}
                        onTrade={jupiter.openPosition}
                        onResetTrade={jupiter.resetTradeState}
                        // Portfolio
                        positions={jupiter.positions}
                        isLoadingPositions={jupiter.isLoadingPositions}
                        onRefreshPositions={jupiter.fetchPositions}
                        onClaimPayout={jupiter.claimPayout}
                        // Mobile
                        onClose={() => setShowMarketPanel(false)}
                    />
                )}
            </Flex>

            {/* Modals */}
            <GiftModal
                isOpen={isGiftModalOpen}
                onClose={() => setIsGiftModalOpen(false)}
                onSend={handleSendGift}
                recipientAddress={selectedContact?.name || ""}
            />

            <AddContactModal
                isOpen={isAddContactModalOpen}
                onClose={() => setIsAddContactModalOpen(false)}
                onAdd={handleAddContact}
            />
        </>
    );
}

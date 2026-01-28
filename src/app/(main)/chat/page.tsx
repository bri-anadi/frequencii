"use client";

import React, { useState, useEffect } from "react";
import { Flex, Text, Column, Button } from "@once-ui-system/core";
import { useAppKit, useAppKitAccount, useDisconnect } from '@reown/appkit/react';
import { useChatRollup } from './hooks/useChatRollup';

import { ChatSidebar } from "./components/ChatSidebar";
import { ChatWindow } from "./components/ChatWindow";
import { GiftModal } from "./components/GiftModal";
import { AddContactModal } from "./components/AddContactModal";

export default function ChatPage() {
    // App State
    const [messages, setMessages] = useState<any[]>([]);
    const [contacts, setContacts] = useState<any[]>([]);
    const [selectedContact, setSelectedContact] = useState<any>(null);

    // UI State
    const [isMobile, setIsMobile] = useState(false);
    const [showChat, setShowChat] = useState(false);
    const [isGiftModalOpen, setIsGiftModalOpen] = useState(false);
    const [isAddContactModalOpen, setIsAddContactModalOpen] = useState(false);
    const [network, setNetwork] = useState<'devnet' | 'mainnet'>('devnet');

    // Persistence
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const savedNetwork = localStorage.getItem('frequencii_network') as 'devnet' | 'mainnet';
            if (savedNetwork && (savedNetwork === 'devnet' || savedNetwork === 'mainnet')) {
                setNetwork(savedNetwork);
            }
        }
    }, []);

    // Wallet
    const { open } = useAppKit();
    const { address, isConnected } = useAppKitAccount();
    const { disconnect } = useDisconnect();
    const isWalletConnected = isConnected;

    const rollup = useChatRollup();

    // Responsive Logic
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Handlers
    const handleContactClick = (contact: any) => {
        setSelectedContact(contact);
        setShowChat(true);
    };

    const handleSendMessage = async (text: string) => {
        // Optimistic update
        const newMessage = {
            id: Date.now().toString(),
            sender: "me",
            text: text,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };
        setMessages(prev => [...prev, newMessage]);

        if (network === 'devnet' && isWalletConnected) {
            try {
                await rollup.sendMessage(text);
                console.log("P2P Message Sent");
            } catch (e) {
                console.error("Failed to send P2P message", e);
                // Optionally mark message as failed in UI
            }
        }
    };

    const handleSendGift = (amount: string, token: string) => {
        const newMessage = {
            id: Date.now().toString(),
            sender: "me",
            type: "gift",
            amount: amount,
            token: token,
            txHash: Array(64).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
            text: `Sent a Crypto Gift: ${amount} ${token}`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages([...messages, newMessage]);
        setIsGiftModalOpen(false);
    };

    const handleAddContact = (newAddress: string) => {
        const newContact = {
            id: Date.now().toString(),
            name: newAddress, // Using address as name for now
            avatar: "",
            status: "gray",
            lastMessage: "New contact added",
        };

        setContacts([...contacts, newContact]);
        setIsAddContactModalOpen(false);
        // Automatically select the new contact if none selected
        if (!selectedContact) {
            setSelectedContact(newContact);
        }
    };

    return (
        <>
            <Flex fillWidth style={{ height: "calc(100vh)" }} padding="m" gap="m">
                {/* Sidebar */}
                {(!isMobile || !showChat) && (
                    <ChatSidebar
                        isMobile={isMobile}
                        contacts={contacts}
                        selectedContact={selectedContact || {}} // Sidebar handles mismatch gracefully usually, or we fix prop type
                        onContactClick={handleContactClick}
                        isWalletConnected={isWalletConnected}
                        onOpenAddContact={() => setIsAddContactModalOpen(true)}
                        onConnectWallet={open}
                        publicKeyString={address}
                        network={network}
                        onNetworkChange={async (newNetwork) => {
                            if (isConnected) {
                                try {
                                    // Use setTimeout to avoid 'Illegal invocation' issues with event loop
                                    setTimeout(async () => {
                                        try {
                                            await disconnect();
                                        } catch (e) {
                                            console.warn("Disconnect error:", e);
                                        }
                                    }, 0);
                                } catch (e) {
                                    console.warn("Disconnect scheduling failed:", e);
                                }
                            }
                            setNetwork(newNetwork);
                            if (typeof window !== 'undefined') {
                                localStorage.setItem('frequencii_network', newNetwork);
                            }
                        }}
                        onDelegate={async () => {
                            try {
                                await rollup.delegate();
                                alert("Delegation request sent!");
                            } catch (e) {
                                console.error(e);
                                alert("Delegation failed. See console.");
                            }
                        }}
                        onUndelegate={async () => {
                            try {
                                await rollup.undelegate();
                                alert("Undelegation request sent!");
                            } catch (e) {
                                console.error(e);
                                alert("Undelegation failed. See console.");
                            }
                        }}
                    />
                )}

                {/* Main Chat Area */}
                {(!isMobile || showChat) && (
                    <>
                        {selectedContact ? (
                            <ChatWindow
                                isMobile={isMobile}
                                selectedContact={selectedContact}
                                messages={messages}
                                onSendMessage={handleSendMessage}
                                onBack={() => setShowChat(false)}
                                onOpenGiftModal={() => setIsGiftModalOpen(true)}
                            />
                        ) : (
                            <Column
                                fillWidth
                                border="neutral-alpha-medium"
                                radius="l"
                                background="surface"
                                center
                                vertical="center"
                                horizontal="center"
                            >
                                <Text variant="heading-strong-s" onBackground="neutral-weak">
                                    Select a contact to start chatting
                                </Text>
                                {!isWalletConnected && (
                                    <Button variant="primary" onClick={() => open()} style={{ marginTop: '16px' }}>
                                        Connect Wallet
                                    </Button>
                                )}
                            </Column>
                        )}
                    </>
                )}
            </Flex>

            <GiftModal
                isOpen={isGiftModalOpen}
                onClose={() => setIsGiftModalOpen(false)}
                onSend={handleSendGift}
                network={network}
            />

            <AddContactModal
                isOpen={isAddContactModalOpen}
                onClose={() => setIsAddContactModalOpen(false)}
                onAdd={handleAddContact}
            />
        </>
    );
}

import React, { useState } from "react";
import {
    Column,
    Row,
    Text,
    Input,
    Button,
    Scroller,
    StatusIndicator,
} from "@once-ui-system/core";
import { formatContactName } from "../utils";

interface ChatSidebarProps {
    isMobile: boolean;
    contacts: any[];
    selectedContact: any;
    onContactClick: (contact: any) => void;
    isWalletConnected: boolean;
    onOpenAddContact: () => void;
    onConnectWallet: () => void;
    publicKeyString?: string;
    network: 'devnet' | 'mainnet';
    onNetworkChange: (network: 'devnet' | 'mainnet') => void;
    onDelegate: () => void;
    onUndelegate: () => void;
}

export const ChatSidebar: React.FC<ChatSidebarProps> = ({
    isMobile,
    contacts,
    selectedContact,
    onContactClick,
    isWalletConnected,
    onOpenAddContact,
    onConnectWallet,
    publicKeyString,
    network,
    onNetworkChange,
    onDelegate,
    onUndelegate,
}) => {
    const [searchQuery, setSearchQuery] = useState("");

    const filteredContacts = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
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
                            onClick={() => onContactClick(contact)}
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
                        onClick={onOpenAddContact}
                    >
                        Add Contact
                    </Button>
                )}
                <Button
                    fillWidth
                    variant={isWalletConnected ? "secondary" : "primary"}
                    onClick={() => onConnectWallet()}
                >
                    {isWalletConnected && publicKeyString
                        ? formatContactName(publicKeyString)
                        : "Connect Wallet"}
                </Button>

                <Row
                    fillWidth
                    background="neutral-medium"
                    radius="m"
                    padding="2"
                    gap="2"
                    vertical="center"
                    style={{ marginTop: '8px' }}
                >
                    <Button
                        fillWidth
                        variant={network === 'devnet' ? 'primary' : 'tertiary'}
                        size="s"
                        onClick={() => onNetworkChange('devnet')}
                    >
                        Devnet
                    </Button>
                    <Button
                        fillWidth
                        variant={network === 'mainnet' ? 'primary' : 'tertiary'}
                        size="s"
                        onClick={() => onNetworkChange('mainnet')}
                    >
                        Mainnet
                    </Button>
                </Row>
            </Column>
        </Column>
    );
};

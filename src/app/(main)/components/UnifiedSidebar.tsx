import React, { useState } from "react";
import {
    Column,
    Row,
    Text,
    Input,
    Button,
    IconButton,
    Scroller,
    StatusIndicator,
} from "@once-ui-system/core";
import { formatContactName } from "@/lib/chatUtils";

interface UnifiedSidebarProps {
    isMobile: boolean;
    contacts: any[];
    selectedRoom: string | null; // "frequant" or contact id
    onRoomSelect: (roomId: string) => void;
    isWalletConnected: boolean;
    onOpenAddContact: () => void;
    onConnectWallet: () => void;
    publicKeyString?: string;
    network: 'devnet' | 'mainnet';
    onNetworkChange: (network: 'devnet' | 'mainnet') => void;
    onDelegate: () => void;
    onUndelegate: () => void;
}



export const UnifiedSidebar: React.FC<UnifiedSidebarProps> = ({
    isMobile,
    contacts,
    selectedRoom,
    onRoomSelect,
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
    const [isCopied, setIsCopied] = useState(false);

    const filteredContacts = contacts.filter(contact =>
        contact.name.toLowerCase().includes(searchQuery.toLowerCase())
    );

    const handleCopy = () => {
        if (publicKeyString) {
            navigator.clipboard.writeText(publicKeyString);
            setIsCopied(true);
            setTimeout(() => setIsCopied(false), 2000);
        }
    };

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

            {/* Pinned Frequant Room */}
            <Button
                variant={selectedRoom === "frequant" ? "secondary" : "tertiary"}
                onClick={() => onRoomSelect("frequant")}
                fillWidth
                style={{ justifyContent: 'flex-start', height: 'auto', marginBottom: '8px' }}
            >
                <Row fillWidth gap="s" vertical="center" paddingY="4">
                    <Column fillWidth gap="4">
                        <Row fillWidth vertical="center" gap="4">
                            <StatusIndicator color="green" />
                            <Text variant="label-default-s">Frequant</Text>
                        </Row>
                        <Text variant="body-default-xs" onBackground="neutral-weak" truncate>
                            AI Prediction Agent
                        </Text>
                    </Column>
                </Row>
            </Button>

            <Column paddingBottom="s">
                <Input
                    id="sidebar-search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search..."
                    height="s"
                />
            </Column>

            {/* Divider */}
            <div style={{ height: 1, background: 'var(--neutral-alpha-medium)', margin: '4px 0' }} />

            {/* Contact list */}
            <Scroller fillWidth>
                <Column gap="4" fillWidth>
                    {filteredContacts.map((contact) => (
                        <Button
                            key={contact.id}
                            variant={selectedRoom === contact.id ? "secondary" : "tertiary"}
                            onClick={() => onRoomSelect(contact.id)}
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

            {/* Bottom controls */}
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
                <Row gap="xs" fillWidth>
                    <Button
                        fillWidth
                        variant={isWalletConnected ? "secondary" : "primary"}
                        onClick={() => onConnectWallet()}
                    >
                        {isWalletConnected && publicKeyString
                            ? formatContactName(publicKeyString)
                            : "Connect Wallet"}
                    </Button>

                    {isWalletConnected && publicKeyString && (
                        <IconButton
                            variant="secondary"
                            onClick={handleCopy}
                            size="l"
                            icon={isCopied ? "check" : "clipboard"}
                            tooltip={isCopied ? "Copied!" : "Copy Address"}
                        />
                    )}
                </Row>

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

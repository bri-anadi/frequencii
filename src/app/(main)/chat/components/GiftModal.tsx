import React, { useState } from "react";
import {
    Flex,
    Column,
    Row,
    Text,
    Button,
    NumberInput,
} from "@once-ui-system/core";
import { giftSchema } from "../utils";
import { useTokenBalance } from "../hooks/useTokenBalance";
import { useAppKitAccount } from '@reown/appkit/react';

interface GiftModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSend: (amount: string, token: string) => void;
    network: 'devnet' | 'mainnet';
}

export const GiftModal: React.FC<GiftModalProps> = ({ isOpen, onClose, onSend, network }) => {
    const [giftAmount, setGiftAmount] = useState("");
    const [giftToken, setGiftToken] = useState("SOL");
    const [giftError, setGiftError] = useState("");

    // Get wallet info for balance check
    const { address, isConnected } = useAppKitAccount();
    const balance = useTokenBalance(
        address || null,
        giftToken,
        isConnected,
        isOpen,
        network
    );

    const handleSendGift = () => {
        const result = giftSchema.safeParse(giftAmount);

        if (!result.success) {
            setGiftError(result.error.issues[0].message);
            return;
        }

        onSend(giftAmount, giftToken);
        setGiftAmount("");
        setGiftError("");
    };

    if (!isOpen) return null;

    return (
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
                    <Flex fillWidth style={{ justifyContent: 'space-between' }}>
                        <Text variant="label-default-s">Amount</Text>
                        {balance !== null && (
                            <Text variant="label-default-s" onBackground="neutral-weak">
                                Balance: {balance.toFixed(4)} {giftToken}
                            </Text>
                        )}
                    </Flex>
                    <NumberInput
                        id="gift-amount"
                        value={Number(giftAmount)}
                        onChange={(value: number) => {
                            const valStr = String(value);
                            setGiftAmount(valStr);
                            const result = giftSchema.safeParse(valStr);
                            if (!result.success) {
                                setGiftError(result.error.issues[0].message);
                            } else if (balance !== null && value > balance) {
                                setGiftError("Insufficient balance");
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
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSendGift} disabled={!giftAmount || !!giftError}>
                        Send Gift
                    </Button>
                </Row>
            </Column>
        </Flex>
    );
};

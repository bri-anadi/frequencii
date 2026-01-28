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
    recipientAddress: string;
}

import { usePrivacyCash } from "../hooks/usePrivacyCash";

export const GiftModal: React.FC<GiftModalProps> = ({ isOpen, onClose, onSend, network, recipientAddress }) => {
    const [giftAmount, setGiftAmount] = useState("");
    const [giftToken, setGiftToken] = useState("SOL");
    const [giftError, setGiftError] = useState("");
    const [txnStatus, setTxnStatus] = useState("");

    // Get wallet info for balance check
    const { address, isConnected } = useAppKitAccount();
    const balance = useTokenBalance(
        address || null,
        giftToken,
        isConnected,
        isOpen,
        network
    );

    const {
        privateBalance,
        isSigned,
        signIn,
        deposit,
        withdraw,
        isLoading: isPrivacyLoading
    } = usePrivacyCash();

    const handleSendGift = async () => {
        setTxnStatus("Validating...");
        const result = giftSchema.safeParse(giftAmount);

        if (!result.success) {
            setGiftError(result.error.issues[0].message);
            setTxnStatus("");
            return;
        }

        const amount = Number(giftAmount);

        try {
            if (!isSigned) {
                setTxnStatus("Prompting Sign In...");
                await signIn();
                setTxnStatus("");
                return; // User needs to click send again after signing, or we can chain it
            }

            const pBalance = privateBalance || 0;
            // Native SOL/Lamports logic for now since PrivacyCash usually is SOL based
            // If token support is added, we check giftToken

            if (giftToken !== 'SOL') {
                setGiftError("PrivacyCash currently supports SOL only.");
                setTxnStatus("");
                return;
            }

            if (!recipientAddress) {
                setGiftError("No recipient address provided.");
                setTxnStatus("");
                return;
            }

            setTxnStatus("Processing...");

            // Check if we need to deposit first
            // Note: privateBalance is in lamports (1e9), amount is in SOL
            const amountLamports = amount * 1e9;
            const currentPrivateLamports = pBalance || 0;

            // 0.05 SOL Buffer for fees (relayer fees can be high)
            const feeBuffer = 0.01 * 1e9;

            if (currentPrivateLamports < (amountLamports + feeBuffer)) {
                // Need top up
                const topUpSol = amount - (currentPrivateLamports / 1e9) + 0.02; // +buffer
                // Or simple logic: just deposit the full amount if balance is low?
                // Let's explicitly deposit strictly what is needed plus buffer
                // Or simpler: Just deposit 'amount' if balance is close to 0

                // Simpler reliable flow:
                // If balance < amount, deposit 'amount' (ignoring existing small dust)
                // Or deposit difference.

                let depositAmount = 0;
                if (currentPrivateLamports < amountLamports) {
                    depositAmount = amount - (currentPrivateLamports / 1e9) + 0.012; // cover fees
                    // ensure positive
                    if (depositAmount < 0.01) depositAmount = 0.01;
                }

                if (depositAmount > 0) {
                    setTxnStatus(`Depositing ${depositAmount.toFixed(4)} SOL...`);
                    await deposit(depositAmount);
                }
                // Re-fetch balance happens automatically in hook but might delay?
                // logic proceeds to withdraw hoping balance is updated or using optimism
            }

            setTxnStatus("Sending Private Gift...");
            const txHash = await withdraw(amount, recipientAddress);

            console.log("Private Transfer complete:", txHash);

            onSend(giftAmount, giftToken); // UI Update
            setGiftAmount("");
            setGiftError("");
            onClose();

        } catch (e: any) {
            console.error(e);
            setGiftError(e.message || "Transaction failed");
        } finally {
            setTxnStatus("");
        }
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
                <Text variant="heading-strong-m">Send Private Gift (PrivacyCash)</Text>

                <Column gap="s">
                    <Flex fillWidth style={{ justifyContent: 'space-between' }}>
                        <Text variant="label-default-s">Amount</Text>
                        <Column horizontal="end">
                            {balance !== null && (
                                <Text variant="label-default-s" onBackground="neutral-weak">
                                    Public: {balance.toFixed(4)} {giftToken}
                                </Text>
                            )}
                            {isSigned && privateBalance !== null && (
                                <Text variant="label-default-s" onBackground="brand-strong" style={{ color: 'var(--brand-solid-strong)' }}>
                                    Private: {(privateBalance / 1e9).toFixed(4)} SOL
                                </Text>
                            )}
                        </Column>
                    </Flex>

                    {!isSigned && (
                        <Button
                            variant="secondary"
                            size="s"
                            onClick={signIn}
                            loading={isPrivacyLoading}
                            fillWidth
                            style={{ marginBottom: '8px' }}
                        >
                            Unlock Private Wallet
                        </Button>
                    )}

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
                    {txnStatus && (
                        <Text variant="label-default-s" onBackground="neutral-weak">
                            {txnStatus}
                        </Text>
                    )}
                </Column>

                {/* Token Selector (Visual only for now if SOL only) */}
                <Column gap="s">
                    <Text variant="label-default-s">Token</Text>
                    <Row gap="s">
                        {['SOL', 'USDC', 'USDT'].map(token => {
                            const isSupported = token === 'SOL';
                            return (
                                <Button
                                    key={token}
                                    variant={giftToken === token ? 'primary' : 'secondary'}
                                    onClick={() => isSupported && setGiftToken(token)}
                                    fillWidth
                                    disabled={!isSupported}
                                    label={!isSupported ? `${token}(soon)` : undefined}
                                >
                                    {token} {!isSupported && "(Soon)"}
                                </Button>
                            );
                        })}
                    </Row>
                </Column>

                <Row gap="s" style={{ justifyContent: 'flex-end' }}>
                    <Button variant="secondary" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button
                        variant="primary"
                        onClick={handleSendGift}
                        disabled={!giftAmount || !!giftError || isPrivacyLoading}
                        loading={isPrivacyLoading}
                    >
                        {isSigned ? "Send Private Gift" : "Unlock & Send"}
                    </Button>
                </Row>
            </Column>
        </Flex>
    );
};

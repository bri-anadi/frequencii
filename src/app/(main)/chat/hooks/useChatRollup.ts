"use client";

import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useAppKitProvider } from '@reown/appkit/react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { useMagicBlock } from '@/components/MagicBlockProvider';
import FrequenciiChatIDL from '@/utils/frequencii_chat.json';
import { FrequenciiChat } from '@/utils/frequencii_chat';
import {
    delegateBufferPdaFromDelegatedAccountAndOwnerProgram,
    delegationRecordPdaFromDelegatedAccount,
    delegationMetadataPdaFromDelegatedAccount,
    DELEGATION_PROGRAM_ID,
    MAGIC_PROGRAM_ID,
} from "@magicblock-labs/ephemeral-rollups-sdk";
import { useCallback, useMemo } from 'react';

const PROGRAM_ID = new PublicKey(FrequenciiChatIDL.address);

export const useChatRollup = () => {
    const { connection } = useConnection();
    const anchorWallet = useAnchorWallet();
    const { walletProvider } = useAppKitProvider('solana');
    const { magicRouter } = useMagicBlock();

    const wallet = useMemo(() => {
        if (anchorWallet) return anchorWallet;
        if (walletProvider) {
            const provider = walletProvider as any;
            return {
                publicKey: new PublicKey(provider.publicKey),
                signTransaction: provider.signTransaction.bind(provider),
                signAllTransactions: provider.signAllTransactions.bind(provider),
            };
        }
        return null;
    }, [anchorWallet, walletProvider]);

    const provider = useMemo(() => {
        if (!wallet) return null;
        return new AnchorProvider(connection, wallet, {
            commitment: 'confirmed',
        });
    }, [connection, wallet]);

    const program = useMemo(() => {
        if (!provider) return null;
        return new Program(FrequenciiChatIDL as Idl, provider as any);
    }, [provider]);

    const getChatRoomPda = useCallback((userKey: PublicKey) => {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("chat"), userKey.toBuffer()],
            PROGRAM_ID
        );
        return pda;
    }, []);

    const initialize = useCallback(async () => {
        if (!program || !wallet) return;
        try {
            const chatRoom = getChatRoomPda(wallet.publicKey);

            // check if exists
            const account = await connection.getAccountInfo(chatRoom);
            if (account) return; // already initialized

            console.log("Initializing chat room...");
            const tx = await program.methods
                .initialize()
                .accounts({
                    chatRoom,
                    user: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log("Initialized signature:", tx);
            return tx;
        } catch (error) {
            console.error("Initialization failed:", error);
            throw error;
        }
    }, [program, wallet, connection, getChatRoomPda]);

    const delegate = useCallback(async () => {
        if (!program || !wallet) return;
        try {
            const chatRoom = getChatRoomPda(wallet.publicKey);

            const buffer = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(chatRoom, PROGRAM_ID);
            const delegationRecord = delegationRecordPdaFromDelegatedAccount(chatRoom);
            const delegationMetadata = delegationMetadataPdaFromDelegatedAccount(chatRoom);

            console.log("Delegating chat room...");
            const tx = await program.methods
                .delegateChat()
                .accounts({
                    chatRoom,
                    user: wallet.publicKey,
                    buffer,
                    delegationRecord,
                    delegationMetadata,
                    magicProgram: DELEGATION_PROGRAM_ID,
                    program: PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log("Delegation signature:", tx);
            return tx;
        } catch (error) {
            console.error("Delegation failed:", error);
            throw error;
        }
    }, [program, wallet, getChatRoomPda]);

    const undelegate = useCallback(async () => {
        if (!program || !wallet) return;
        try {
            const chatRoom = getChatRoomPda(wallet.publicKey);
            const buffer = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(chatRoom, PROGRAM_ID);

            console.log("Undelegating chat room...");
            const tx = await program.methods
                .undelegateChat()
                .accounts({
                    chatRoom,
                    user: wallet.publicKey,
                    buffer,
                    magicProgram: DELEGATION_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log("Undelegation signature:", tx);
            return tx;
        } catch (error) {
            console.error("Undelegation failed:", error);
            throw error;
        }
    }, [program, wallet, getChatRoomPda]);

    const sendMessage = useCallback(async (content: string) => {
        if (!program || !wallet || !magicRouter) {
            console.error("Missing program, wallet, or magicRouter for sendMessage");
            return;
        }

        try {
            const chatRoom = getChatRoomPda(wallet.publicKey);

            console.log("Sending P2P message:", content);

            // Build instruction using Anchor
            const instruction = await program.methods
                .sendMessage(content)
                .accounts({
                    chatRoom,
                    user: wallet.publicKey,
                })
                .instruction();

            const tx = new Transaction().add(instruction);
            tx.feePayer = wallet.publicKey;
            tx.recentBlockhash = (await magicRouter.getLatestBlockhash()).blockhash;

            // Sign
            const signedTx = await wallet.signTransaction(tx);

            // Send via Magic Router
            const signature = await magicRouter.sendRawTransaction(signedTx.serialize());
            console.log("Message sent via ER, signature:", signature);

            // Optionally wait for confirmation if UX requires it
            // await magicRouter.confirmTransaction(signature);
            // console.log("Message confirmed on ER");

            return signature;
        } catch (error) {
            console.error("Failed to send P2P message:", error);
            throw error;
        }
    }, [program, wallet, magicRouter, getChatRoomPda]);

    return {
        initialize,
        delegate,
        undelegate,
        sendMessage,
        program,
        getChatRoomPda,
    };
};

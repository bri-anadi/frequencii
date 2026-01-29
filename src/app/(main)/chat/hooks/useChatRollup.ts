"use client";

import { useAnchorWallet, useConnection } from '@solana/wallet-adapter-react';
import { useAppKitProvider } from '@reown/appkit/react';
import { PublicKey, Transaction, SystemProgram } from '@solana/web3.js';
import { Program, AnchorProvider, Idl } from '@coral-xyz/anchor';
import { useMagicBlock } from '@/components/MagicBlockProvider';
import FrequenciiChatIDL from '@/utils/frequencii_chat.json';

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
        // Use standard connection for provider (stable for state fetching/listeners on L1 if needed)
        // usage for transactions will be overridden in sendMessage or methods
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
            [Buffer.from("chat_v2"), userKey.toBuffer()],
            PROGRAM_ID
        );
        return pda;
    }, []);

    const initialize = useCallback(async () => {
        if (!program || !wallet) return;
        try {
            const chatRoom = getChatRoomPda(wallet.publicKey);
            console.log("Initializing chat room...", chatRoom.toBase58());
            const tx = await program.methods
                .initialize()
                .accounts({
                    chatRoom,
                    user: wallet.publicKey,
                    systemProgram: SystemProgram.programId,
                })
                .rpc();
            console.log("Initialization signature:", tx);
            return tx;
        } catch (error) {
            console.error("Initialization failed:", error);
            throw error;
        }
    }, [program, wallet, getChatRoomPda]);

    const delegate = useCallback(async () => {
        if (!program || !wallet) return;
        try {
            const chatRoom = getChatRoomPda(wallet.publicKey);

            // 1. Check current state
            const chatAccountInfo = await connection.getAccountInfo(chatRoom);
            let isInitialized = chatAccountInfo !== null;

            const delegationRecord = delegationRecordPdaFromDelegatedAccount(chatRoom);
            const delegationAccountInfo = await connection.getAccountInfo(delegationRecord);
            const isDelegated = delegationAccountInfo !== null;

            if (isDelegated) {
                console.log("Already delegated.");
                return;
            }

            console.log(`Delegating chat room (Initialized: ${isInitialized})...`);

            const transaction = new Transaction();

            if (!isInitialized) {
                console.log("Auto-initializing before delegation...");
                const initIx = await program.methods
                    .initialize()
                    .accounts({
                        chatRoom,
                        user: wallet.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();
                transaction.add(initIx);
            }

            const buffer = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(chatRoom, PROGRAM_ID);
            const delegationMetadata = delegationMetadataPdaFromDelegatedAccount(chatRoom);

            const delegateIx = await program.methods
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
                .instruction();
            transaction.add(delegateIx);

            transaction.feePayer = wallet.publicKey;
            const { blockhash } = await connection.getLatestBlockhash();
            transaction.recentBlockhash = blockhash;

            const signedTx = await wallet.signTransaction(transaction);
            const signature = await connection.sendRawTransaction(signedTx.serialize());
            await connection.confirmTransaction(signature);

            console.log("Delegation signature:", signature);
            return signature;
        } catch (error) {
            console.error("Delegation failed:", error);
            throw error;
        }
    }, [program, wallet, getChatRoomPda, connection]);

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
        if (!program || !wallet || !connection) return;
        try {
            const chatRoom = getChatRoomPda(wallet.publicKey);

            // 1. Check if chat account exists
            const chatAccountInfo = await connection.getAccountInfo(chatRoom);
            let isInitialized = chatAccountInfo !== null;

            // 2. Check if delegated (only if initialized)
            let isDelegated = false;
            if (isInitialized) {
                const delegationRecord = delegationRecordPdaFromDelegatedAccount(chatRoom);
                const delegationAccountInfo = await connection.getAccountInfo(delegationRecord);
                isDelegated = delegationAccountInfo !== null;
            }

            console.log(`Sending P2P message (Initialized: ${isInitialized}, Delegated: ${isDelegated}):`, content);

            const transaction = new Transaction();
            let needsL1 = false;

            // Auto-initialize if needed
            if (!isInitialized) {
                console.log("Auto-initializing chat room...");
                const initIx = await program.methods
                    .initialize()
                    .accounts({
                        chatRoom,
                        user: wallet.publicKey,
                        systemProgram: SystemProgram.programId,
                    })
                    .instruction();
                transaction.add(initIx);
                needsL1 = true;
                // isInitialized = true;
            }

            // Auto-delegate if needed
            if (!isDelegated) {
                console.log("Auto-delegating chat room...");
                const buffer = delegateBufferPdaFromDelegatedAccountAndOwnerProgram(chatRoom, PROGRAM_ID);
                const delegationRecord = delegationRecordPdaFromDelegatedAccount(chatRoom);
                const delegationMetadata = delegationMetadataPdaFromDelegatedAccount(chatRoom);

                const delegateIx = await program.methods
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
                    .instruction();
                transaction.add(delegateIx);
                needsL1 = true;
            }

            // Build sendMessage instruction
            const msgIx = await program.methods
                .sendMessage(content)
                .accounts({
                    chatRoom,
                    user: wallet.publicKey,
                })
                .instruction();
            transaction.add(msgIx);

            transaction.feePayer = wallet.publicKey;

            // Decision: If we did any setup (Init or Delegate), we MUST use L1 this time.
            // If we were already delegated and didn't touch anything, we use ER.
            if (!needsL1 && isDelegated && magicRouter) {
                // ER Mode (Fast, Cheap/Free)
                transaction.recentBlockhash = (await magicRouter.getLatestBlockhash()).blockhash;
                const signedTx = await wallet.signTransaction(transaction);
                const signature = await magicRouter.sendRawTransaction(signedTx.serialize());
                console.log("Message sent via ER (MagicBlock), signature:", signature);
                return signature;
            } else {
                // L1 Mode (Setup Phase)
                const { blockhash } = await connection.getLatestBlockhash();
                transaction.recentBlockhash = blockhash;
                const signedTx = await wallet.signTransaction(transaction);
                const signature = await connection.sendRawTransaction(signedTx.serialize());
                await connection.confirmTransaction(signature);
                console.log("Message & Setup sent via L1, signature:", signature);
                return signature;
            }
        } catch (error) {
            console.error("Failed to send P2P message:", error);
            throw error;
        }
    }, [program, wallet, connection, getChatRoomPda, magicRouter]);

    return {
        program,
        connection,
        initialize,
        delegate,
        undelegate,
        sendMessage,
    };
};

"use client";

import { useEffect, useRef, useCallback } from 'react';
import { useChatRollup } from './useChatRollup';
import { PublicKey } from '@solana/web3.js';
import { useAnchorWallet } from '@solana/wallet-adapter-react';
import { useMagicBlock } from '@/components/MagicBlockProvider';
import FrequenciiChatIDL from '@/utils/frequencii_chat.json';

const PROGRAM_ID = new PublicKey(FrequenciiChatIDL.address);

export interface ChatMessageEvent {
    sender: PublicKey;
    content: string;
    timestamp: number;
}

export const useChatListener = (
    contacts: { name: string }[],
    onMessageReceived: (message: ChatMessageEvent) => void
) => {
    const { program } = useChatRollup();
    const wallet = useAnchorWallet();
    const { magicRouter } = useMagicBlock();

    // Map to track the last processed timestamp for EACH contact (Sender Public Key -> Timestamp)
    const lastTimestampMapRef = useRef<Record<string, number>>({});
    const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const getChatRoomPda = useCallback((userKey: PublicKey) => {
        const [pda] = PublicKey.findProgramAddressSync(
            [Buffer.from("chat_v2"), userKey.toBuffer()],
            PROGRAM_ID
        );
        return pda;
    }, []);

    useEffect(() => {
        if (!program || !magicRouter) {
            // console.error("FORCE DEBUG: Returning early because Program or Router is missing.", { program: !!program, magicRouter: !!magicRouter });
            return;
        }

        // console.error("FORCE DEBUG: Setting up Multi-Contact Polling Listener (MagicRouter)...");

        // Use magicRouter from provider for connectionReuse
        const fetchMessagesForContact = async (contactAddressStr: string) => {
            try {
                const contactKey = new PublicKey(contactAddressStr);
                const chatRoomPda = getChatRoomPda(contactKey);

                const accountInfo = await magicRouter.getAccountInfo(chatRoomPda);

                if (accountInfo) {
                    // Log raw account details to verify we are hitting the right place
                    console.log("FORCE DEBUG: Account Found!", {
                        address: chatRoomPda.toBase58(),
                        owner: accountInfo.owner.toBase58(),
                        dataLen: accountInfo.data.length,
                        first8Bytes: accountInfo.data.slice(0, 8).toString('hex')
                    });

                    // DEBUG: Check what accounts Anchor knows about
                    if (program.account) {
                        console.log("FORCE DEBUG: Anchor Account Names:", Object.keys(program.account));
                    }

                    // Decode
                    let decoded;
                    try {
                        // Try standard PascalCase first (as in IDL)
                        decoded = program.coder.accounts.decode("ChatRoom", accountInfo.data);
                    } catch (err) {
                        console.warn("FORCE DEBUG: Failed to decode as 'ChatRoom', trying 'chatRoom'...", err);
                        try {
                            // Try camelCase (common in Anchor JS)
                            decoded = program.coder.accounts.decode("chatRoom", accountInfo.data);
                        } catch (err2) {
                            console.error("FORCE DEBUG: Failed to decode as 'chatRoom' too.");
                            // throw err2; // Let it fail gracefully
                        }
                    }

                    if (decoded) {
                        console.log("FORCE DEBUG: Decoded Account Messages count:", decoded.messages?.length);
                    }

                    if (decoded && decoded.messages) {
                        const messages = decoded.messages as any[];
                        const lastTs = lastTimestampMapRef.current[contactAddressStr] || 0;

                        // Filter new messages
                        const newMessages = messages.filter((msg: any) =>
                            msg.timestamp.toNumber() > lastTs
                        );

                        if (newMessages.length > 0) {
                            newMessages.sort((a: any, b: any) => a.timestamp.toNumber() - b.timestamp.toNumber());

                            newMessages.forEach((msg: any) => {
                                const timestamp = msg.timestamp.toNumber();
                                console.log(`New Message from ${contactAddressStr}:`, msg.content);

                                onMessageReceived({
                                    sender: msg.sender,
                                    content: msg.content,
                                    timestamp: timestamp,
                                });

                                if (timestamp > (lastTimestampMapRef.current[contactAddressStr] || 0)) {
                                    lastTimestampMapRef.current[contactAddressStr] = timestamp;
                                }
                            });
                        }
                    }
                }
            } catch (e) {
                console.error(`FORCE DEBUG: Polling failed for ${contactAddressStr}`, e);
            }
        };

        const pollAllContacts = async () => {
            const tasks = contacts.map(c => fetchMessagesForContact(c.name));
            await Promise.all(tasks);
        };

        // Initial fetch
        pollAllContacts();

        // Start polling every 2 seconds
        pollingIntervalRef.current = setInterval(pollAllContacts, 2000);

        return () => {
            if (pollingIntervalRef.current) {
                clearInterval(pollingIntervalRef.current);
                pollingIntervalRef.current = null;
            }
        };
    }, [program, wallet, contacts, getChatRoomPda, onMessageReceived, magicRouter]);
};

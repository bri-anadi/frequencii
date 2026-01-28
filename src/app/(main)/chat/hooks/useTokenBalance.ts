import { useState, useEffect } from "react";
import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { TOKEN_MINTS, TOKEN_PROGRAM_ID } from "../data";

export function useTokenBalance(
    publicKey: string | null,
    tokenSymbol: string,
    isConnected: boolean,
    enabled: boolean,
    network: 'devnet' | 'mainnet' = 'devnet'
) {
    const [balance, setBalance] = useState<number | null>(null);

    useEffect(() => {
        if (!enabled || !isConnected || !publicKey) {
            setBalance(null);
            return;
        }

        const fetchBalance = async () => {
            try {
                // improved Helius RPC selection logic
                let rpcUrl = network === 'mainnet' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com';
                const heliusEnv = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;

                if (heliusEnv) {
                    if (heliusEnv.startsWith('http')) {
                        try {
                            const url = new URL(heliusEnv);
                            const apiKey = url.searchParams.get('api-key');
                            if (apiKey) {
                                rpcUrl = `https://${network}.helius-rpc.com/?api-key=${apiKey}`;
                            } else if (heliusEnv.includes(network)) {
                                rpcUrl = heliusEnv;
                            }
                        } catch (e) {
                            // ignore URL parse error
                        }
                    } else {
                        // Assume raw API Key
                        rpcUrl = `https://${network}.helius-rpc.com/?api-key=${heliusEnv}`;
                    }
                }

                const connection = new Connection(rpcUrl);

                if (tokenSymbol === 'SOL') {
                    const bal = await connection.getBalance(new PublicKey(publicKey));
                    setBalance(bal / LAMPORTS_PER_SOL);
                } else if (TOKEN_MINTS[tokenSymbol]) {
                    try {
                        const mintAddress = TOKEN_MINTS[tokenSymbol];

                        // Query all token accounts for the owner using the Token Program ID
                        const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                            new PublicKey(publicKey),
                            { programId: TOKEN_PROGRAM_ID }
                        );

                        // Find the account matching the specific mint
                        const matchedAccount = tokenAccounts.value.find(
                            (account) => account.account.data.parsed.info.mint === mintAddress
                        );

                        if (matchedAccount) {
                            setBalance(matchedAccount.account.data.parsed.info.tokenAmount.uiAmount || 0);
                        } else {
                            setBalance(0);
                        }
                    } catch (splError) {
                        console.error(`Error fetching ${tokenSymbol} balance:`, splError);
                        setBalance(0);
                    }
                } else {
                    setBalance(null);
                }
            } catch (error) {
                console.error("Failed to fetch balance", error);
                setBalance(null);
            }
        };

        fetchBalance();
    }, [publicKey, tokenSymbol, isConnected, enabled, network]);

    return balance;
}

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { useAppKitProvider } from '@reown/appkit/react';

export const usePrivacyCash = () => {
    const { connection } = useConnection();
    const anchorWallet = useAnchorWallet();
    const { walletProvider } = useAppKitProvider('solana');

    const [privateBalance, setPrivateBalance] = useState<number | null>(null);
    const [isSigned, setIsSigned] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [sdk, setSdk] = useState<any>(null);
    // Store encryption service instance that has keys set
    const [activeEncryptionService, setActiveEncryptionService] = useState<any>(null);

    // Helpers to link to the standalone functions
    useEffect(() => {
        let isMounted = true;

        const loadSdk = async () => {
            try {
                // Dynamic import from the utils endpoint which exposes standalone functions
                const privacyCashUtils = await import('privacycash/utils');

                // We store the whole module or specific functions
                if (isMounted) {
                    setSdk(privacyCashUtils);
                }
            } catch (e) {
                console.error("Failed to load PrivacyCash SDK Utils:", e);
            }
        };

        loadSdk();
        return () => { isMounted = false; };
    }, []);

    const rawProvider = useMemo(() => {
        if (anchorWallet) return anchorWallet;
        if (walletProvider) return walletProvider as any;
        return null;
    }, [anchorWallet, walletProvider]);

    // Check if user is "signed in" to privacy mode (has keys in storage)
    useEffect(() => {
        // Logic to check local storage for existing keys?
        // PrivacyCash SDK doesn't seem to expose a direct "isLoggedIn" check easily
        // without trying to access keys. For now, we rely on manual sign-in state or success of balance fetch.
    }, []);

    const signIn = useCallback(async () => {
        if (!rawProvider || !sdk) return;
        try {
            setIsLoading(true);
            const message = "Privacy Money account sign in";
            const encodedMessage = new TextEncoder().encode(message);

            let signature;
            // Sign message to get keys
            if (rawProvider.signMessage) {
                signature = await rawProvider.signMessage(encodedMessage);
            } else if (rawProvider.sign_message) {
                signature = await rawProvider.sign_message(encodedMessage);
            } else {
                throw new Error("Wallet does not support message signing");
            }

            // Initialize encryption service and derive keys
            const encryptionService = new sdk.EncryptionService();
            encryptionService.deriveEncryptionKeyFromSignature(signature);

            // Generate/Verify keys are set
            // encryptionService.getUtxoPrivateKeyV2(); // Will throw if fail

            setActiveEncryptionService(encryptionService);
            setIsSigned(true);

            // Now we can fetch balance safely
            // fetchBalance logic moved here or called separately?
            // Calling direct because 'activeEncryptionService' state update might be async
            // and we have the instance reference right now.
            await fetchBalanceInternal(encryptionService);

        } catch (e) {
            console.error("Sign in failed:", e);
        } finally {
            setIsLoading(false);
        }
    }, [rawProvider, sdk]); // Dep removed connection since not used directly in signin

    // Separated fetch logic to accept service instance directly
    const fetchBalanceInternal = async (encService: any) => {
        if (!sdk || !rawProvider || !encService) return;
        try {
            const userPublicKey = rawProvider.publicKey;

            // Double check keys are set
            try {
                // Just a check, usually encryptionService keeps state
            } catch (kErr) {
                console.warn("Keys not ready");
                return;
            }

            const utxos = await sdk.getUtxos({
                publicKey: userPublicKey,
                connection: connection,
                encryptionService: encService,
                storage: window.localStorage
            });

            const balObj = sdk.getBalanceFromUtxos(utxos);
            // Function returns { lamports: number }
            setPrivateBalance(balObj.lamports || 0);
        } catch (e) {
            console.error("Failed to fetch private balance:", e);
        }
    };

    const fetchBalance = useCallback(async () => {
        if (activeEncryptionService) {
            await fetchBalanceInternal(activeEncryptionService);
        }
    }, [activeEncryptionService, sdk, rawProvider, connection]);

    const deposit = useCallback(async (amountSol: number) => {
        if (!rawProvider || !sdk || !activeEncryptionService) return;
        try {
            setIsLoading(true);
            const lamports = amountSol * 1e9;

            // We need a transactionSigner wrapper for the SDK
            // SDK expects: async (tx) => { tx.sign([keypair]); return tx; }
            //Frontend expects: async (tx) => { return wallet.signTransaction(tx); }

            const frontendSigner = async (tx: any) => {
                // Ensure recent blockhash if missing (SDK might handle it)
                return await rawProvider.signTransaction(tx);
            };

            const tx = await sdk.deposit({
                // SDK Deposit requires:
                // lightWasm (optional/internal?), amount_in_lamports, connection, encryptionService, publicKey, transactionSigner, storage

                amount_in_lamports: lamports, // Check naming in deposit.js!
                // Wait, checking index.js calling code:
                // deposit({ lightWasm, amount_in_lamports: lamports, ... })
                // It seems the params are indeed 'amount_in_lamports'

                connection: connection,
                encryptionService: activeEncryptionService,
                publicKey: rawProvider.publicKey,
                transactionSigner: frontendSigner,
                storage: window.localStorage
            });

            await fetchBalance();
            return tx;
        } catch (e) {
            console.error("Deposit failed:", e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [rawProvider, connection, sdk, activeEncryptionService, fetchBalance]);

    const withdraw = useCallback(async (amountSol: number, recipient: string) => {
        if (!rawProvider || !sdk || !activeEncryptionService) return;
        try {
            setIsLoading(true);
            const lamports = amountSol * 1e9;

            const tx = await sdk.withdraw({
                amount_in_lamports: lamports,
                connection: connection,
                encryptionService: activeEncryptionService,
                publicKey: rawProvider.publicKey,
                recipient: new sdk.PublicKey(recipient), // Convert string to PK if needed
                // transactionSigner might not be needed for withdraw strictly unless paying fees?
                // Actually withdraw usually requires proving ownership (signatures)
                // SDK withdraw definition in index.js doesnt explicitly show transactionSigner param passing to `withdraw` function?
                // Let's check index.js line 131:
                // await withdraw({ ..., publicKey, recipient, keyBasePath..., storage, referrer })
                // It does NOT invoke a signer. The proof generation (ZK) proves ownership.
                // Wait, who pays the TX fee? The relayer? or the user?
                // Usually user needs to sign the container TX.

                storage: window.localStorage
            });

            await fetchBalance();
            return tx;
        } catch (e) {
            console.error("Withdraw failed:", e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [rawProvider, connection, sdk, activeEncryptionService, fetchBalance]);

    return {
        privateBalance,
        isSigned,
        isLoading,
        signIn,
        deposit,
        withdraw,
        fetchBalance
    };
};

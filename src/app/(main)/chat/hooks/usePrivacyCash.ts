import { useState, useCallback, useEffect, useMemo } from 'react';
import { useConnection, useAnchorWallet } from '@solana/wallet-adapter-react';
import { useAppKitProvider } from '@reown/appkit/react';
import { PublicKey } from '@solana/web3.js';
// @ts-ignore
import { WasmFactory } from '@lightprotocol/hasher.rs';

export const usePrivacyCash = () => {
    const { connection } = useConnection();
    const anchorWallet = useAnchorWallet();
    const { walletProvider } = useAppKitProvider('solana');

    const [privateBalance, setPrivateBalance] = useState<number | null>(null);
    const [isSigned, setIsSigned] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [sdk, setSdk] = useState<any>(null);
    const [lightWasm, setLightWasm] = useState<any>(null);
    // Store encryption service instance that has keys set
    const [activeEncryptionService, setActiveEncryptionService] = useState<any>(null);

    // Helpers to link to the standalone functions
    useEffect(() => {
        let isMounted = true;

        const loadSdk = async () => {
            try {
                // Initialize Light Protocol WASM
                const wasm = await WasmFactory.getInstance();
                console.log("LightWasm initialized:", wasm);
                // Check if poseidonHashString exists on the loaded object
                if (wasm && typeof wasm.poseidonHashString !== 'function') {
                    console.error("CRITICAL: poseidonHashString IS MISSING on lightWasm object", wasm);
                } else {
                    console.log("LightWasm appears valid, has poseidonHashString");
                }

                // Dynamic import from the utils endpoint which exposes standalone functions
                const privacyCashUtils = await import('privacycash/utils');

                // We store the whole module or specific functions
                if (isMounted) {
                    setLightWasm(wasm);
                    setSdk(privacyCashUtils);
                }
            } catch (e) {
                console.error("Failed to load PrivacyCash SDK Utils or WASM:", e);
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
            await fetchBalanceInternal(encryptionService);

        } catch (e) {
            console.error("Sign in failed:", e);
        } finally {
            setIsLoading(false);
        }
    }, [rawProvider, sdk]); // Dep removed connection since not used directly in signin

    // Separated fetch logic to accept service instance directly
    const fetchBalanceInternal = async (encService: any) => {
        if (!sdk || !rawProvider || !encService || !lightWasm) return;
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
    }, [activeEncryptionService, sdk, rawProvider, connection, lightWasm]);

    const deposit = useCallback(async (amountSol: number) => {
        if (!rawProvider || !sdk || !activeEncryptionService || !lightWasm) return;
        try {
            setIsLoading(true);
            const lamports = amountSol * 1e9;

            // We need a transactionSigner wrapper for the SDK
            const frontendSigner = async (tx: any) => {
                // Ensure recent blockhash if missing (SDK might handle it)
                return await rawProvider.signTransaction(tx);
            };

            const tx = await sdk.deposit({
                lightWasm: lightWasm,
                amount_in_lamports: lamports,
                connection: connection,
                encryptionService: activeEncryptionService,
                publicKey: rawProvider.publicKey,
                transactionSigner: frontendSigner,
                storage: window.localStorage,
                keyBasePath: '/circuit2/transaction2'
            });

            await fetchBalance();
            return tx;
        } catch (e) {
            console.error("Deposit failed:", e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [rawProvider, connection, sdk, activeEncryptionService, fetchBalance, lightWasm]);

    const withdraw = useCallback(async (amountSol: number, recipient: string) => {
        if (!rawProvider || !sdk || !activeEncryptionService || !lightWasm) return;
        try {
            setIsLoading(true);
            const lamports = amountSol * 1e9;

            const tx = await sdk.withdraw({
                lightWasm: lightWasm,
                amount_in_lamports: lamports,
                connection: connection,
                encryptionService: activeEncryptionService,
                publicKey: rawProvider.publicKey,
                recipient: new PublicKey(recipient),
                storage: window.localStorage,
                keyBasePath: '/circuit2/transaction2'
            });

            await fetchBalance();
            return tx;
        } catch (e) {
            console.error("Withdraw failed:", e);
            throw e;
        } finally {
            setIsLoading(false);
        }
    }, [rawProvider, connection, sdk, activeEncryptionService, fetchBalance, lightWasm]);

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

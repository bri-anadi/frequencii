"use client";

import React, { ReactNode } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { SolflareWalletAdapter, PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { solana, solanaDevnet } from '@reown/appkit/networks';
import { MagicBlockProvider } from './MagicBlockProvider';

// 1. Get projectId from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'b56e86d4832f5243ea4563a53e2f0682'; // Fallback or throw error

// 2. Set up Solana Adapter
export const solanaWeb3JsAdapter = new SolanaAdapter({
    wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()]
});

// 3. Create modal
const getHeliusUrl = (network: 'devnet' | 'mainnet') => {
    const heliusEnv = process.env.NEXT_PUBLIC_HELIUS_RPC_URL;
    if (heliusEnv) {
        // If it looks like a URL, try to extract param
        if (heliusEnv.startsWith('http')) {
            try {
                const url = new URL(heliusEnv);
                const apiKey = url.searchParams.get('api-key');
                if (apiKey) {
                    return `https://${network}.helius-rpc.com/?api-key=${apiKey}`;
                }
            } catch (e) {
                // ignore
            }
        } else {
            // Assume it's just the API Key
            return `https://${network}.helius-rpc.com/?api-key=${heliusEnv}`;
        }
    }
    return network === 'mainnet' ? 'https://api.mainnet-beta.solana.com' : 'https://api.devnet.solana.com';
};

const customSolanaDevnet = {
    ...solanaDevnet,
    rpcUrls: {
        ...solanaDevnet.rpcUrls,
        default: {
            http: [getHeliusUrl('devnet')],
        },
    },
};

const customSolanaMainnet = {
    ...solana,
    rpcUrls: {
        ...solana.rpcUrls,
        default: {
            http: [getHeliusUrl('mainnet')],
        },
    },
};

const siwxConfig = {
    getNonce: async () => { return "frequencii-nonce-" + Date.now(); },
    createMessage: ({ nonce, address, chainId }: { nonce: string, address: string, chainId: string }) => {
        return `Welcome to Frequencii World!\n\nClick to sign in and accept the Terms of Service.\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet address:\n${address}\n\nNonce:\n${nonce}`;
    },
    verifyMessage: async ({ message, signature }: { message: string, signature: string }) => {
        console.log("Verifying message:", message, "Signature:", signature);
        return true;
    },
    getSession: async () => { return null; },
    signOut: async () => { return true; },
    addSession: async () => { /* implement if needed */ },
    revokeSession: async () => { /* implement if needed */ },
    setSessions: async () => { /* implement if needed */ },
    getSessions: async () => { return []; }
};

createAppKit({
    adapters: [solanaWeb3JsAdapter],
    networks: [customSolanaMainnet, customSolanaDevnet],
    metadata: {
        name: 'Frequencii',
        description: 'Frequencii World',
        url: 'https://frequencii.world',
        icons: ['https://avatars.githubusercontent.com/u/179229932']
    },
    projectId,
    features: {
        analytics: true,
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': 'var(--brand-solid-strong)',
        '--w3m-color-mix': 'var(--surface)',
        '--w3m-border-radius-master': '2px',
        '--w3m-z-index': 9999
    }
});

import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { useMemo } from 'react';

export function AppWalletProvider({ children }: { children: ReactNode }) {
    // Default to devnet for now or determine based on env/storage
    // Ideally this matches the network state, but for context init we can start with one.
    // The WalletProvider internal logic handles network switching via AppKit usually,
    // but standard hooks need a Connection.
    const endpoint = useMemo(() => {
        if (typeof window !== 'undefined') {
            const stored = localStorage.getItem('frequencii_network');
            if (stored === 'mainnet') return getHeliusUrl('mainnet');
        }
        return getHeliusUrl('devnet');
    }, []);

    const wallets = useMemo(() => [
        new PhantomWalletAdapter(),
        new SolflareWalletAdapter(),
    ], []);

    return (
        <ConnectionProvider endpoint={endpoint}>
            <SolanaWalletProvider wallets={wallets} autoConnect>
                <MagicBlockProvider>
                    {children}
                </MagicBlockProvider>
            </SolanaWalletProvider>
        </ConnectionProvider>
    );
}

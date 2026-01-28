"use client";

import React, { ReactNode } from 'react';
import { createAppKit } from '@reown/appkit/react';
import { SolanaAdapter } from '@reown/appkit-adapter-solana';
import { SolflareWalletAdapter, PhantomWalletAdapter } from '@solana/wallet-adapter-wallets';
import { solana, solanaDevnet } from '@reown/appkit/networks';

// 1. Get projectId from https://cloud.reown.com
const projectId = process.env.NEXT_PUBLIC_REOWN_PROJECT_ID || 'b56e86d4832f5243ea4563a53e2f0682'; // Fallback or throw error

// 2. Set up Solana Adapter
export const solanaWeb3JsAdapter = new SolanaAdapter({
    wallets: [new PhantomWalletAdapter(), new SolflareWalletAdapter()]
});

// 3. Create modal
const customSolanaDevnet = {
    ...solanaDevnet,
    rpcUrls: {
        ...solanaDevnet.rpcUrls,
        default: {
            http: [process.env.NEXT_PUBLIC_HELIUS_RPC_URL || 'https://api.devnet.solana.com'],
        },
    },
};

createAppKit({
    adapters: [solanaWeb3JsAdapter],
    networks: [solana, customSolanaDevnet],
    metadata: {
        name: 'Frequencii',
        description: 'Solana P2P Chat',
        url: 'https://frequencii.world',
        icons: ['https://avatars.githubusercontent.com/u/179229932']
    },
    projectId,
    features: {
        analytics: true,
        email: false,
        socials: false
    },
    themeMode: 'dark',
    themeVariables: {
        '--w3m-font-family': 'var(--font-family)',
        '--w3m-accent': 'var(--brand-solid-strong)',
        '--w3m-color-mix': 'var(--surface)',
        '--w3m-border-radius-master': '2px',
        '--w3m-z-index': 9999
    }
});

export function AppWalletProvider({ children }: { children: ReactNode }) {
    return (
        <>
            {children}
        </>
    );
}

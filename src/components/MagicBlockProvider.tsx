"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ConnectionMagicRouter } from '@magicblock-labs/ephemeral-rollups-sdk';
import { useConnection } from '@solana/wallet-adapter-react';

interface MagicBlockContextType {
    magicRouter: ConnectionMagicRouter | null;
}

const MagicBlockContext = createContext<MagicBlockContextType>({
    magicRouter: null,
});

export const MagicBlockProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    // We can default to devnet for now, or make it dynamic based on generic network state
    // stored in localStorage or from WalletProvider, but let's hardcode devnet for this integration phase.
    const ROUTER_ENDPOINT = "https://devnet-router.magicblock.app";
    const WS_ENDPOINT = "wss://devnet-router.magicblock.app";

    const magicRouter = useMemo(() => {
        try {
            return new ConnectionMagicRouter(ROUTER_ENDPOINT, {
                commitment: "confirmed",
                wsEndpoint: WS_ENDPOINT
            });
        } catch (error) {
            console.error("Failed to initialize MagicBlock Router:", error);
            return null;
        }
    }, []);

    return (
        <MagicBlockContext.Provider value={{ magicRouter }}>
            {children}
        </MagicBlockContext.Provider>
    );
};

export const useMagicBlock = () => useContext(MagicBlockContext);

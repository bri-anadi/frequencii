import { MobileWalletProvider as SolanaMobileWalletProvider } from "@wallet-ui/react-native-web3js";
import type { ReactNode } from "react";
import { SOLANA_CHAIN, SOLANA_RPC_URL } from "../config/env";
import { walletAuthorizationCache } from "./authorizationCache";

const identity = {
  name: "Frequencii",
  uri: "https://frequencii.world",
  icon: "favicon.ico",
};

export function MobileWalletProvider({ children }: { children: ReactNode }) {
  return (
    <SolanaMobileWalletProvider
      cache={walletAuthorizationCache}
      chain={SOLANA_CHAIN}
      endpoint={SOLANA_RPC_URL}
      identity={identity}
      key={`${SOLANA_CHAIN}:${SOLANA_RPC_URL}`}
    >
      {children}
    </SolanaMobileWalletProvider>
  );
}

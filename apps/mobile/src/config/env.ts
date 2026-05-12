declare const process: {
  env: Record<string, string | undefined>;
};

export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? "https://www.frequencii.world";

export type SupportedSolanaChain = "solana:mainnet";

const MAINNET_CHAIN: SupportedSolanaChain = "solana:mainnet";
const MAINNET_RPC_URL = "https://api.mainnet-beta.solana.com";

function resolveMainnetChain(value: string | undefined): SupportedSolanaChain {
  if (!value || value === "solana:mainnet" || value === "mainnet-beta" || value === "mainnet") {
    return MAINNET_CHAIN;
  }

  return MAINNET_CHAIN;
}

function resolveMainnetRpcUrl(value: string | undefined) {
  if (!value || /devnet|testnet/i.test(value)) {
    return MAINNET_RPC_URL;
  }

  return value;
}

export const SOLANA_CHAIN = resolveMainnetChain(process.env.EXPO_PUBLIC_SOLANA_CHAIN);
export const SOLANA_RPC_URL = resolveMainnetRpcUrl(process.env.EXPO_PUBLIC_SOLANA_RPC_URL);

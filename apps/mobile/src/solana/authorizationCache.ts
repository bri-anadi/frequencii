import { PublicKey } from "@solana/web3.js";
import type { Cache, WalletAuthorization } from "@wallet-ui/react-native-web3js";
import * as SecureStore from "expo-secure-store";

const WALLET_AUTHORIZATION_STORAGE_KEY = "frequencii_mwa_authorization_mainnet_v1";

function reviveWalletAuthorization(key: string, value: unknown) {
  if ((key === "address" || key === "publicKey") && typeof value === "string") {
    return new PublicKey(value);
  }

  return value;
}

export const walletAuthorizationCache: Cache<WalletAuthorization | undefined> = {
  async clear() {
    await SecureStore.deleteItemAsync(WALLET_AUTHORIZATION_STORAGE_KEY);
  },
  async get() {
    const cachedAuthorization = await SecureStore.getItemAsync(WALLET_AUTHORIZATION_STORAGE_KEY);
    if (!cachedAuthorization) {
      return undefined;
    }

    try {
      return JSON.parse(cachedAuthorization, reviveWalletAuthorization) as WalletAuthorization;
    } catch {
      await SecureStore.deleteItemAsync(WALLET_AUTHORIZATION_STORAGE_KEY);
      return undefined;
    }
  },
  async set(value) {
    if (!value) {
      await SecureStore.deleteItemAsync(WALLET_AUTHORIZATION_STORAGE_KEY);
      return;
    }

    await SecureStore.setItemAsync(WALLET_AUTHORIZATION_STORAGE_KEY, JSON.stringify(value));
  },
};

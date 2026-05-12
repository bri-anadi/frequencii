import { useMobileWallet } from "@wallet-ui/react-native-web3js";

type WalletAccountLike = {
  address?: unknown;
  publicKey?: unknown;
};

export function getWalletAccountAddress(account: WalletAccountLike | null | undefined) {
  const candidates = [account?.address, account?.publicKey];

  for (const candidate of candidates) {
    if (!candidate) continue;
    if (typeof candidate === "string") return candidate;
    if (
      typeof candidate === "object" &&
      "toBase58" in candidate &&
      typeof candidate.toBase58 === "function"
    ) {
      return candidate.toBase58();
    }
    if (
      typeof candidate === "object" &&
      "toString" in candidate &&
      typeof candidate.toString === "function"
    ) {
      return candidate.toString();
    }
  }

  return null;
}

export function useFrequenciiWallet() {
  const wallet = useMobileWallet();
  const address = getWalletAccountAddress(wallet.account);

  return {
    ...wallet,
    address,
    isConnected: Boolean(address),
  };
}

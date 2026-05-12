import { Keypair } from "@solana/web3.js";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFrequenciiWallet } from "../../solana/useFrequenciiWallet";
import { API_BASE_URL } from "../../config/env";

const BURNER_PUBKEY_KEY = "frequencii_burner_pubkey";
const BURNER_ENCRYPTED_KEY = "frequencii_burner_encrypted";
const SIGN_MESSAGE = "Frequencii Private Prediction Wallet";
const BALANCE_POLL_INTERVAL = 15_000;

export type BurnerSetupStep = "idle" | "generating" | "signing" | "encrypting" | "stored";
export type BurnerState = "none" | "locked" | "unlocked";

// Use react-native-quick-crypto for AES-GCM
let crypto: typeof import("react-native-quick-crypto") | null = null;
try {
  crypto = require("react-native-quick-crypto");
} catch {
  // Not available — will show guarded state
}

function deriveAesKey(signature: Uint8Array): Uint8Array {
  if (signature.length < 32) {
    throw new Error("Wallet signature too short. Please try again.");
  }
  return signature.slice(0, 32);
}

function encrypt(secretKey: Uint8Array, aesKey: Uint8Array): string {
  if (!crypto) throw new Error("Crypto module not available");

  const iv = crypto.randomBytes(12);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cipher = crypto.createCipheriv("aes-256-gcm", aesKey as any, iv as any);
  const encrypted = Buffer.concat([
    cipher.update(Buffer.from(secretKey)) as unknown as Uint8Array,
    cipher.final() as unknown as Uint8Array,
  ]);
  const tag = cipher.getAuthTag();

  // Format: iv(12) + tag(16) + ciphertext
  const result = Buffer.concat([
    Buffer.from(iv),
    Buffer.from(tag),
    encrypted,
  ]);
  return result.toString("base64");
}

function decrypt(ciphertext: string, aesKey: Uint8Array): Uint8Array {
  if (!crypto) throw new Error("Crypto module not available");

  const data = Buffer.from(ciphertext, "base64");
  const iv = data.subarray(0, 12);
  const tag = data.subarray(12, 28);
  const encrypted = data.subarray(28);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const decipher = crypto.createDecipheriv("aes-256-gcm", aesKey as any, iv as any);
  decipher.setAuthTag(tag as any);
  const decrypted = Buffer.concat([
    decipher.update(encrypted as any) as unknown as Uint8Array,
    decipher.final() as unknown as Uint8Array,
  ]);

  return new Uint8Array(decrypted);
}

export function useBurnerWallet() {
  const wallet = useFrequenciiWallet();
  const [state, setState] = useState<BurnerState>("none");
  const [setupStep, setSetupStep] = useState<BurnerSetupStep>("idle");
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const keypairRef = useRef<Keypair | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Check if burner wallet exists on mount
  useEffect(() => {
    async function check() {
      const storedPubkey = await SecureStore.getItemAsync(BURNER_PUBKEY_KEY);
      if (storedPubkey) {
        setPublicKey(storedPubkey);
        setState("locked");
      } else {
        setState("none");
      }
    }
    check();
  }, []);

  // Balance polling
  const startBalancePolling = useCallback((pubkey: string) => {
    const fetchBalance = async () => {
      try {
        const rpcUrl = process.env.EXPO_PUBLIC_SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";
        const response = await fetch(rpcUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            method: "getBalance",
            params: [pubkey],
          }),
        });
        const data = await response.json();
        if (data.result?.value != null) {
          setBalance(data.result.value / 1e9); // lamports to SOL
        }
      } catch {
        // Silent failure on balance poll
      }
    };

    fetchBalance();
    pollRef.current = setInterval(fetchBalance, BALANCE_POLL_INTERVAL);
  }, []);

  const stopBalancePolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // Setup new burner wallet
  const setup = useCallback(async () => {
    if (!crypto) {
      setError("Crypto module not available. Native build required.");
      return;
    }

    setError(null);
    setSetupStep("generating");

    try {
      // Step 1: Generate keypair
      const seed = crypto.randomBytes(32);
      const keypair = Keypair.fromSeed(seed);
      const pubkeyStr = keypair.publicKey.toBase58();

      // Step 2: Request MWA signature
      setSetupStep("signing");
      const payload = Buffer.from(SIGN_MESSAGE, "utf8");

      let signature: Uint8Array;
      try {
        const result = await (wallet as any).connectAnd(async (mwaWallet: any) => {
          const authResult = await mwaWallet.authorize({
            chain: (wallet as any).chain,
            identity: (wallet as any).identity,
          });
          const account = authResult.accounts[0];
          const signedPayloads = await mwaWallet.signMessages({
            addresses: [account.addressBase64 ?? account.address],
            payloads: [payload],
          });
          return (signedPayloads[0] as Uint8Array).slice(0, 64);
        });
        signature = result as unknown as Uint8Array;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/cancel/i.test(msg)) {
          setSetupStep("idle");
          return;
        }
        throw new Error(`MWA signing failed: ${msg}`);
      }

      // Step 3: Encrypt
      setSetupStep("encrypting");
      const aesKey = deriveAesKey(signature);
      const ciphertext = encrypt(keypair.secretKey, aesKey);

      // Step 4: Store
      try {
        await SecureStore.setItemAsync(BURNER_ENCRYPTED_KEY, ciphertext);
        await SecureStore.setItemAsync(BURNER_PUBKEY_KEY, pubkeyStr);
      } catch {
        throw new Error("Failed to save wallet. Check device storage and try again.");
      }

      setSetupStep("stored");
      setPublicKey(pubkeyStr);
      setState("locked");
      keypairRef.current = null; // Don't keep in memory after setup

      // Reset step after brief display
      setTimeout(() => setSetupStep("idle"), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Setup failed");
      setSetupStep("idle");
    }
  }, [wallet]);

  // Unlock existing burner wallet
  const unlock = useCallback(async () => {
    if (!crypto) {
      setError("Crypto module not available.");
      return;
    }

    setError(null);

    try {
      const storedCiphertext = await SecureStore.getItemAsync(BURNER_ENCRYPTED_KEY);
      const storedPubkey = await SecureStore.getItemAsync(BURNER_PUBKEY_KEY);

      if (!storedCiphertext || !storedPubkey) {
        setError("No burner wallet found. Please set up first.");
        return;
      }

      // Request MWA signature
      const payload = Buffer.from(SIGN_MESSAGE, "utf8");

      let signature: Uint8Array;
      try {
        const result = await (wallet as any).connectAnd(async (mwaWallet: any) => {
          const authResult = await mwaWallet.authorize({
            chain: (wallet as any).chain,
            identity: (wallet as any).identity,
          });
          const account = authResult.accounts[0];
          const signedPayloads = await mwaWallet.signMessages({
            addresses: [account.addressBase64 ?? account.address],
            payloads: [payload],
          });
          return (signedPayloads[0] as Uint8Array).slice(0, 64);
        });
        signature = result as unknown as Uint8Array;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/cancel/i.test(msg)) return;
        throw new Error("Unlock failed. Please try again.");
      }

      // Decrypt
      const aesKey = deriveAesKey(signature);
      let secretKey: Uint8Array;
      try {
        secretKey = decrypt(storedCiphertext, aesKey);
      } catch {
        throw new Error("Unlock failed. Please try again.");
      }

      // Verify pubkey match
      const keypair = Keypair.fromSecretKey(secretKey);
      if (keypair.publicKey.toBase58() !== storedPubkey) {
        throw new Error(
          "Decryption produced wrong key. Was this wallet created with a different main wallet?",
        );
      }

      keypairRef.current = keypair;
      setState("unlocked");
      startBalancePolling(storedPubkey);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unlock failed");
    }
  }, [wallet, startBalancePolling]);

  // Lock (clear from memory)
  const lock = useCallback(() => {
    keypairRef.current = null;
    setState("locked");
    setBalance(null);
    stopBalancePolling();
  }, [stopBalancePolling]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      keypairRef.current = null;
      stopBalancePolling();
    };
  }, [stopBalancePolling]);

  const shortPublicKey = publicKey
    ? `${publicKey.slice(0, 4)}...${publicKey.slice(-4)}`
    : null;

  return {
    balance,
    error,
    keypair: keypairRef.current,
    lock,
    publicKey,
    setup,
    setupStep,
    shortPublicKey,
    state,
    unlock,
  };
}

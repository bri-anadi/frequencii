import { useState, useCallback, useEffect, useMemo } from "react";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { useAppKitProvider } from "@reown/appkit/react";
import { Keypair, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { usePrivacyCash } from "./usePrivacyCash";
import type { BurnerSetupStep } from "../types";

const STORAGE_KEY = "frequencii_burner_wallet";
const SIGN_MESSAGE = "Frequencii Private Prediction Wallet";

/**
 * Derive a deterministic AES-GCM encryption key from a wallet signature.
 * Uses the first 32 bytes of the signature as raw key material.
 */
async function deriveKeyFromSignature(
  signature: Uint8Array
): Promise<CryptoKey> {
  const keyMaterial = signature.slice(0, 32);
  return crypto.subtle.importKey("raw", keyMaterial, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

async function encryptData(
  data: Uint8Array,
  key: CryptoKey
): Promise<{ iv: string; ciphertext: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  return {
    iv: Buffer.from(iv).toString("base64"),
    ciphertext: Buffer.from(ciphertext).toString("base64"),
  };
}

async function decryptData(
  encrypted: { iv: string; ciphertext: string },
  key: CryptoKey
): Promise<Uint8Array> {
  const iv = Buffer.from(encrypted.iv, "base64");
  const ciphertext = Buffer.from(encrypted.ciphertext, "base64");
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    ciphertext
  );
  return new Uint8Array(decrypted);
}

export function useBurnerWallet() {
  const { connection } = useConnection();
  const anchorWallet = useAnchorWallet();
  const { walletProvider } = useAppKitProvider("solana");
  const privacyCash = usePrivacyCash();

  const [isSetup, setIsSetup] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [publicKey, setPublicKey] = useState<string | null>(null);
  const [balance, setBalance] = useState<number>(0);
  const [step, setStep] = useState<BurnerSetupStep>("idle");
  const [stepMessage, setStepMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  // In-memory only — never persisted decrypted
  const [burnerKeypair, setBurnerKeypair] = useState<Keypair | null>(null);

  const rawProvider = useMemo(() => {
    if (anchorWallet) return anchorWallet;
    if (walletProvider) return walletProvider as any;
    return null;
  }, [anchorWallet, walletProvider]);

  // Check if burner wallet exists in localStorage on mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        setPublicKey(parsed.publicKey);
        setIsSetup(true);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  // Fetch burner wallet balance when unlocked
  useEffect(() => {
    if (!publicKey || !connection) return;

    const fetchBalance = async () => {
      try {
        const pk = new PublicKey(publicKey);
        const bal = await connection.getBalance(pk);
        setBalance(bal);
      } catch (err) {
        console.error("Failed to fetch burner balance:", err);
      }
    };

    fetchBalance();
    const interval = setInterval(fetchBalance, 15_000); // Every 15s
    return () => clearInterval(interval);
  }, [publicKey, connection]);

  /**
   * Sign a message with the main wallet to derive encryption keys.
   */
  const signForKey = useCallback(async (): Promise<Uint8Array> => {
    if (!rawProvider) throw new Error("Wallet not connected");

    const encodedMessage = new TextEncoder().encode(SIGN_MESSAGE);
    let signature: Uint8Array;

    if (rawProvider.signMessage) {
      signature = await rawProvider.signMessage(encodedMessage);
    } else if (rawProvider.sign_message) {
      signature = await rawProvider.sign_message(encodedMessage);
    } else {
      throw new Error("Wallet does not support message signing");
    }

    return signature;
  }, [rawProvider]);

  /**
   * Step 1-3: Generate a new burner wallet, encrypt it, store it.
   */
  const setupBurnerWallet = useCallback(async () => {
    setError(null);

    try {
      // Step 1: Generate keypair
      setStep("generating");
      setStepMessage("Generating private wallet keypair...");
      const keypair = Keypair.generate();
      await new Promise((r) => setTimeout(r, 500)); // UX pause

      // Step 2: Sign to derive encryption key
      setStep("signing");
      setStepMessage(
        "Sign the message with your main wallet to encrypt your private wallet..."
      );
      const signature = await signForKey();

      // Step 3: Encrypt and store
      setStep("encrypting");
      setStepMessage("Encrypting and storing private wallet...");
      const cryptoKey = await deriveKeyFromSignature(signature);
      const encrypted = await encryptData(keypair.secretKey, cryptoKey);

      const storagePayload = {
        publicKey: keypair.publicKey.toBase58(),
        encrypted,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storagePayload));

      setPublicKey(keypair.publicKey.toBase58());
      setBurnerKeypair(keypair);
      setIsSetup(true);
      setIsUnlocked(true);
      setStep("stored");
      setStepMessage("Private wallet created and encrypted.");

      return keypair.publicKey.toBase58();
    } catch (err: any) {
      console.error("Burner wallet setup failed:", err);
      setError(err.message || "Setup failed");
      setStep("idle");
      setStepMessage("");
      throw err;
    }
  }, [signForKey]);

  /**
   * Unlock existing burner wallet by re-signing and decrypting.
   */
  const unlockBurnerWallet = useCallback(async () => {
    setError(null);

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) throw new Error("No private wallet found. Please set up first.");

      const parsed = JSON.parse(stored);

      setStep("signing");
      setStepMessage("Sign to unlock your private wallet...");
      const signature = await signForKey();

      setStep("encrypting");
      setStepMessage("Decrypting private wallet...");
      const cryptoKey = await deriveKeyFromSignature(signature);
      const secretKeyBytes = await decryptData(parsed.encrypted, cryptoKey);

      const keypair = Keypair.fromSecretKey(secretKeyBytes);

      // Verify key matches stored public key
      if (keypair.publicKey.toBase58() !== parsed.publicKey) {
        throw new Error("Decryption produced wrong key. Was this wallet created with a different main wallet?");
      }

      setBurnerKeypair(keypair);
      setPublicKey(parsed.publicKey);
      setIsUnlocked(true);
      setStep("complete");
      setStepMessage("Private wallet unlocked.");
    } catch (err: any) {
      console.error("Unlock failed:", err);
      setError(err.message || "Unlock failed");
      setStep("idle");
      throw err;
    }
  }, [signForKey]);

  /**
   * Step 4-6: Fund burner wallet via PrivacyCash (deposit to shield, withdraw to burner).
   */
  const fundBurnerWallet = useCallback(
    async (amountSol: number) => {
      if (!publicKey) throw new Error("Private wallet not set up");
      setError(null);

      try {
        // Ensure PrivacyCash is signed in
        if (!privacyCash.isSigned) {
          setStep("signing");
          setStepMessage("Signing into PrivacyCash privacy layer...");
          await privacyCash.signIn();
        }

        // Step 4: Deposit to shielded pool
        setStep("depositing");
        setStepMessage(
          `Depositing ${amountSol} SOL into ZK shielded pool...`
        );
        await privacyCash.deposit(amountSol);

        // Step 5: Withdraw to burner address (ZK break link)
        setStep("withdrawing");
        setStepMessage(
          `Withdrawing ${amountSol} SOL to private wallet via ZK proof... (this breaks the on-chain link)`
        );
        await privacyCash.withdraw(amountSol, publicKey);

        // Step 6: Complete
        setStep("complete");
        setStepMessage(
          `Private wallet funded with ${amountSol} SOL. No on-chain link to your main wallet.`
        );

        // Refresh balance
        if (connection) {
          const pk = new PublicKey(publicKey);
          const bal = await connection.getBalance(pk);
          setBalance(bal);
        }
      } catch (err: any) {
        console.error("Funding failed:", err);
        setError(err.message || "Funding failed");
        setStep("idle");
        throw err;
      }
    },
    [publicKey, privacyCash, connection]
  );

  /**
   * Sign a transaction with the burner wallet keypair.
   * The transaction is signed in-memory — burner private key never leaves the browser.
   */
  const signTransaction = useCallback(
    async (transaction: any) => {
      if (!burnerKeypair) {
        throw new Error("Private wallet is locked. Please unlock first.");
      }
      transaction.sign(burnerKeypair);
      return transaction;
    },
    [burnerKeypair]
  );

  /**
   * Get the burner balance in SOL (not lamports).
   */
  const balanceSol = balance / LAMPORTS_PER_SOL;

  /**
   * Reset / delete burner wallet.
   */
  const resetBurnerWallet = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setBurnerKeypair(null);
    setPublicKey(null);
    setBalance(0);
    setIsSetup(false);
    setIsUnlocked(false);
    setStep("idle");
    setStepMessage("");
    setError(null);
  }, []);

  return {
    // State
    isSetup,
    isUnlocked,
    publicKey,
    balance,
    balanceSol,
    step,
    stepMessage,
    error,
    privacyCashSigned: privacyCash.isSigned,
    privacyCashBalance: privacyCash.privateBalance,

    // Actions
    setupBurnerWallet,
    unlockBurnerWallet,
    fundBurnerWallet,
    signTransaction,
    resetBurnerWallet,
  };
}

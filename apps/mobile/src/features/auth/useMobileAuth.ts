import type { AuthRefreshResponse, LoginResponse } from "@frequencii/shared";
import bs58 from "bs58";
import { Buffer } from "buffer";
import * as SecureStore from "expo-secure-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { apiRequest } from "../../api/client";
import {
  getWalletAccountAddress,
  useFrequenciiWallet,
} from "../../solana/useFrequenciiWallet";
import { walletAuthorizationCache } from "../../solana/authorizationCache";

const TOKEN_STORAGE_KEY = "frequencii_mobile_jwt";
const USER_STORAGE_KEY = "frequencii_mobile_user";
const WALLET_REQUEST_TIMEOUT_MS = 45_000;

function withWalletTimeout<T>(request: Promise<T>, action: "connect" | "sign") {
  return new Promise<T>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(
        new Error(
          `Wallet ${action} request timed out. Please reopen your wallet and approve the request.`,
        ),
      );
    }, WALLET_REQUEST_TIMEOUT_MS);

    request
      .then((value) => {
        clearTimeout(timeout);
        resolve(value);
      })
      .catch((err: unknown) => {
        clearTimeout(timeout);
        reject(err);
      });
  });
}

async function clearStoredSession() {
  await Promise.all([
    SecureStore.deleteItemAsync(TOKEN_STORAGE_KEY),
    SecureStore.deleteItemAsync(USER_STORAGE_KEY),
  ]);
}

async function storeSession(response: LoginResponse) {
  await Promise.all([
    SecureStore.setItemAsync(TOKEN_STORAGE_KEY, response.token),
    SecureStore.setItemAsync(USER_STORAGE_KEY, JSON.stringify(response.user)),
  ]);
}

async function safeDisconnect(wallet: ReturnType<typeof useFrequenciiWallet>) {
  await wallet.disconnect().catch(() => undefined);
}

function isInvalidWalletAuthorizationError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  return /auth.*token.*(not valid|invalid|expired)|authorization.*failed/i.test(message);
}

function isWalletSessionError(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  return /TimeoutException|timed out|response with id|session closed|endSession|MobileWalletAdapter/i.test(
    message,
  );
}

function getAuthErrorMessage(err: unknown) {
  const message = err instanceof Error ? err.message : String(err);

  if (/CancellationException|cancelled|canceled/i.test(message)) {
    return "Wallet request was cancelled. Please tap Connect Wallet and approve the signature again.";
  }

  if (isWalletSessionError(err)) {
    return "Wallet request timed out. Reopen your wallet, approve the request, then tap Connect Wallet again.";
  }

  if (isInvalidWalletAuthorizationError(err)) {
    return "Wallet session expired after switching wallets. Tap Reset Wallet Session, then connect again.";
  }

  return message || "Sign in failed";
}

export function useMobileAuth() {
  const wallet = useFrequenciiWallet();
  const signInAttemptRef = useRef(0);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<LoginResponse["user"] | null>(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restore() {
      try {
        const [storedToken, storedUser] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_STORAGE_KEY),
          SecureStore.getItemAsync(USER_STORAGE_KEY),
        ]);

        if (!cancelled) {
          setToken(storedToken);
          setUser(storedUser ? JSON.parse(storedUser) : null);
        }
      } catch {
        if (!cancelled) {
          setToken(null);
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    }

    restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const signIn = useCallback(async () => {
    const attemptId = signInAttemptRef.current + 1;
    signInAttemptRef.current = attemptId;
    setError(null);
    setIsSigningIn(true);
    const isCurrentAttempt = () => signInAttemptRef.current === attemptId;

    try {
      // Clear stale MWA auth to force fresh authorize (prevents reauthorize failures)
      await walletAuthorizationCache.clear();
      await wallet.disconnect().catch(() => undefined);

      const message = `Frequencii Auth: ${Date.now()}`;

      // Use connectAnd to authorize + sign in ONE transact session (one wallet open)
      const result = await withWalletTimeout(
        wallet.connectAnd(async (mwaWallet) => {
          // authorize inside the same session
          const authResult = await mwaWallet.authorize({
            chain: wallet.chain,
            identity: wallet.identity,
          });

          const account = authResult.accounts[0];
          const pubkey = account?.address?.toBase58?.() ?? account?.address ?? account?.publicKey?.toBase58?.();
          if (!pubkey) throw new Error("Wallet did not return a public key");

          // sign inside the same session (no second wallet open)
          const payload = Buffer.from(message, "utf8");
          const signedPayloads = await mwaWallet.signMessages({
            addresses: [account.addressBase64],
            payloads: [payload],
          });

          // MWA signMessages returns signature(64) + message
          const signature = (signedPayloads[0] as Uint8Array).slice(0, 64);
          return { pubkey: String(pubkey), signature };
        }),
        "connect",
      );

      if (!isCurrentAttempt() || !result) return null;

      const { pubkey, signature } = result as { pubkey: string; signature: Uint8Array };

      const response = await apiRequest<LoginResponse>("/api/v1/auth/login", {
        method: "POST",
        body: JSON.stringify({
          pubkey,
          message,
          signature: bs58.encode(signature),
        }),
      });

      if (!isCurrentAttempt()) return null;

      await storeSession(response);

      setToken(response.token);
      setUser(response.user);
      return response;
    } catch (err) {
      if (isInvalidWalletAuthorizationError(err) || isWalletSessionError(err)) {
        await safeDisconnect(wallet);
      }
      if (isCurrentAttempt()) {
        setError(getAuthErrorMessage(err));
      }
      return null;
    } finally {
      if (isCurrentAttempt()) {
        setIsSigningIn(false);
      }
    }
  }, [wallet]);

  const resetWalletSession = useCallback(async () => {
    signInAttemptRef.current += 1;
    setIsSigningIn(false);
    await clearStoredSession();
    await safeDisconnect(wallet);
    setToken(null);
    setUser(null);
    setError(null);
  }, [wallet]);

  const signOut = useCallback(async () => {
    signInAttemptRef.current += 1;
    await clearStoredSession();
    await safeDisconnect(wallet);
    setToken(null);
    setUser(null);
    setError(null);
  }, [wallet]);

  const refreshSession = useCallback(async () => {
    if (!token) {
      throw new Error("No active session to refresh");
    }

    const response = await apiRequest<AuthRefreshResponse>("/api/v1/auth/refresh", {
      method: "POST",
      token,
    });
    await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, response.token);
    setToken(response.token);
    return response;
  }, [token]);

  // Proactive refresh when app returns to foreground (Task 11.2)
  useEffect(() => {
    const subscription = AppState.addEventListener("change", async (nextState) => {
      if (nextState === "active" && token) {
        try {
          // Decode JWT to check expiry (without verification — just reading payload)
          const parts = token.split(".");
          if (parts.length === 3) {
            const payload = JSON.parse(Buffer.from(parts[1], "base64").toString("utf8"));
            const expiresAt = (payload.exp ?? 0) * 1000;
            const remainingMs = expiresAt - Date.now();
            // Refresh if less than 60 minutes remaining
            if (remainingMs > 0 && remainingMs < 60 * 60 * 1000) {
              const response = await apiRequest<AuthRefreshResponse>("/api/v1/auth/refresh", {
                method: "POST",
                token,
              });
              await SecureStore.setItemAsync(TOKEN_STORAGE_KEY, response.token);
              setToken(response.token);
            }
          }
        } catch {
          // Proactive refresh failed — don't show error, try again next foreground
        }
      }
    });

    return () => subscription.remove();
  }, [token]);

  return {
    error,
    isRestoring,
    isSigningIn,
    refreshSession,
    resetWalletSession,
    signIn,
    signOut,
    token,
    user,
    wallet,
  };
}

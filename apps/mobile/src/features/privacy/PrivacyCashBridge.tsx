/**
 * PrivacyCash WebView Bridge
 *
 * Runs the PrivacyCash SDK + Light Protocol WASM inside a hidden WebView.
 * React Native communicates via postMessage to execute deposit/withdraw operations.
 * This avoids the WASM limitation in React Native's JS engine.
 */
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewMessageEvent } from "react-native-webview";
import { SOLANA_RPC_URL } from "../../config/env";

export interface PrivacyCashBridgeRef {
  signIn: (walletSignature: string, publicKey: string) => Promise<void>;
  getBalance: (publicKey: string) => Promise<number>;
  deposit: (amount: number, publicKey: string, signedTx: string) => Promise<string>;
  withdraw: (amount: number, publicKey: string, recipient: string) => Promise<string>;
  isReady: boolean;
}

type PendingRequest = {
  resolve: (value: any) => void;
  reject: (error: Error) => void;
};

const BRIDGE_HTML = `
<!DOCTYPE html>
<html>
<head>
  <script src="https://unpkg.com/privacycash@1.1.11/dist/browser/privacycash.min.js"></script>
  <script src="https://unpkg.com/@lightprotocol/hasher.rs@0.2.1/dist/wasm/light_hasher_bg.js"></script>
</head>
<body>
<script>
  const RPC_URL = "${SOLANA_RPC_URL}";
  let sdk = null;
  let lightWasm = null;
  let encryptionService = null;
  let isInitialized = false;

  async function initialize() {
    try {
      // Try loading the SDK modules
      if (window.privacycash) {
        sdk = window.privacycash;
      }
      if (window.LightHasher) {
        lightWasm = await window.LightHasher.WasmFactory.getInstance();
      }
      isInitialized = true;
      sendToRN({ type: 'ready', success: true });
    } catch (e) {
      sendToRN({ type: 'ready', success: false, error: e.message });
    }
  }

  function sendToRN(data) {
    window.ReactNativeWebView.postMessage(JSON.stringify(data));
  }

  // Handle messages from React Native
  window.addEventListener('message', async (event) => {
    const msg = JSON.parse(event.data);
    const { id, action, params } = msg;

    try {
      let result;

      switch (action) {
        case 'signIn': {
          const { signature, publicKey } = params;
          const sigBytes = Uint8Array.from(atob(signature), c => c.charCodeAt(0));
          encryptionService = new sdk.EncryptionService();
          encryptionService.deriveEncryptionKeyFromSignature(sigBytes);
          result = { success: true };
          break;
        }

        case 'getBalance': {
          const { publicKey } = params;
          if (!encryptionService) throw new Error('Not signed in');
          const connection = { rpcEndpoint: RPC_URL };
          const utxos = await sdk.getUtxos({
            publicKey,
            connection,
            encryptionService,
            storage: localStorage
          });
          const bal = sdk.getBalanceFromUtxos(utxos);
          result = { balance: bal.lamports || 0 };
          break;
        }

        case 'deposit': {
          const { amount, publicKey } = params;
          if (!encryptionService || !lightWasm) throw new Error('Not initialized');
          // Build deposit transaction (unsigned)
          const tx = await sdk.buildDepositTransaction({
            lightWasm,
            amount_in_lamports: Math.round(amount * 1e9),
            connection: { rpcEndpoint: RPC_URL },
            encryptionService,
            publicKey,
            storage: localStorage,
            keyBasePath: '/circuit2/transaction2'
          });
          // Serialize and return for RN to sign via MWA
          const serialized = btoa(String.fromCharCode(...new Uint8Array(tx.serialize())));
          result = { transaction: serialized };
          break;
        }

        case 'withdraw': {
          const { amount, publicKey, recipient } = params;
          if (!encryptionService || !lightWasm) throw new Error('Not initialized');
          const tx = await sdk.buildWithdrawTransaction({
            lightWasm,
            amount_in_lamports: Math.round(amount * 1e9),
            connection: { rpcEndpoint: RPC_URL },
            encryptionService,
            publicKey,
            recipient,
            storage: localStorage,
            keyBasePath: '/circuit2/transaction2'
          });
          const serialized = btoa(String.fromCharCode(...new Uint8Array(tx.serialize())));
          result = { transaction: serialized };
          break;
        }

        default:
          throw new Error('Unknown action: ' + action);
      }

      sendToRN({ type: 'response', id, result });
    } catch (e) {
      sendToRN({ type: 'response', id, error: e.message || 'Bridge error' });
    }
  });

  // Also listen for document message (Android)
  document.addEventListener('message', (event) => {
    window.dispatchEvent(new MessageEvent('message', { data: event.data }));
  });

  initialize();
</script>
</body>
</html>
`;

export const PrivacyCashBridge = forwardRef<PrivacyCashBridgeRef>((_, ref) => {
  const webViewRef = useRef<WebView>(null);
  const pendingRequests = useRef<Map<string, PendingRequest>>(new Map());
  const [isReady, setIsReady] = useState(false);
  let requestId = useRef(0);

  const sendCommand = useCallback(
    (action: string, params: Record<string, any>): Promise<any> => {
      return new Promise((resolve, reject) => {
        const id = String(++requestId.current);
        pendingRequests.current.set(id, { resolve, reject });

        const message = JSON.stringify({ id, action, params });
        webViewRef.current?.injectJavaScript(`
          window.dispatchEvent(new MessageEvent('message', { data: '${message.replace(/'/g, "\\'")}' }));
          true;
        `);

        // Timeout after 30s
        setTimeout(() => {
          if (pendingRequests.current.has(id)) {
            pendingRequests.current.delete(id);
            reject(new Error(`Bridge timeout for action: ${action}`));
          }
        }, 30000);
      });
    },
    [],
  );

  const handleMessage = useCallback((event: WebViewMessageEvent) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);

      if (data.type === "ready") {
        setIsReady(data.success);
        return;
      }

      if (data.type === "response" && data.id) {
        const pending = pendingRequests.current.get(data.id);
        if (pending) {
          pendingRequests.current.delete(data.id);
          if (data.error) {
            pending.reject(new Error(data.error));
          } else {
            pending.resolve(data.result);
          }
        }
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  useImperativeHandle(ref, () => ({
    isReady,
    signIn: async (walletSignature: string, publicKey: string) => {
      await sendCommand("signIn", { signature: walletSignature, publicKey });
    },
    getBalance: async (publicKey: string) => {
      const result = await sendCommand("getBalance", { publicKey });
      return result.balance;
    },
    deposit: async (amount: number, publicKey: string) => {
      const result = await sendCommand("deposit", { amount, publicKey });
      return result.transaction;
    },
    withdraw: async (amount: number, publicKey: string, recipient: string) => {
      const result = await sendCommand("withdraw", { amount, publicKey, recipient });
      return result.transaction;
    },
  }));

  return (
    <View style={styles.hidden}>
      <WebView
        ref={webViewRef}
        originWhitelist={["*"]}
        source={{ html: BRIDGE_HTML }}
        onMessage={handleMessage}
        javaScriptEnabled
        domStorageEnabled
        style={styles.webview}
      />
    </View>
  );
});

PrivacyCashBridge.displayName = "PrivacyCashBridge";

const styles = StyleSheet.create({
  hidden: {
    height: 0,
    overflow: "hidden",
    width: 0,
  },
  webview: {
    height: 0,
    width: 0,
  },
});

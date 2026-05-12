import type { TradeOutcome, TradeRequest, TradeResponse } from "@frequencii/shared";
import { Transaction, VersionedTransaction } from "@solana/web3.js";
import { Buffer } from "buffer";
import { useCallback, useState } from "react";
import { apiRequest } from "../../api/client";
import { useFrequenciiWallet } from "../../solana/useFrequenciiWallet";

export function useMobileJupiterPredict(token: string) {
  const wallet = useFrequenciiWallet();
  const [isTrading, setIsTrading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const openPosition = useCallback(
    async (params: Omit<TradeRequest, "walletPubkey"> & { outcome: TradeOutcome }) => {
      if (!wallet.account) {
        throw new Error("Connect wallet before trading");
      }
      if (!wallet.address) {
        throw new Error("Wallet did not return a public key");
      }

      setIsTrading(true);
      setStatusMessage("Building transaction");

      try {
        const response = await apiRequest<TradeResponse>("/api/v1/trade", {
          method: "POST",
          token,
          body: JSON.stringify({
            ...params,
            walletPubkey: wallet.address,
          }),
        });

        const serialized = getSerializedTransaction(response);
        if (!serialized) {
          throw new Error("Trade API did not return a serialized transaction");
        }

        setStatusMessage("Simulating transaction");
        const transaction = deserializeTransaction(serialized);
        const simulation =
          transaction instanceof VersionedTransaction
            ? await wallet.connection.simulateTransaction(transaction)
            : await wallet.connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }

        const slot = simulation.context.slot;
        setStatusMessage("Requesting wallet signature");
        const signature = await wallet.signAndSendTransaction(transaction, slot);
        const txid = Array.isArray(signature) ? signature[0] : signature;
        setStatusMessage(`Submitted ${txid}`);
        return txid;
      } finally {
        setIsTrading(false);
      }
    },
    [token, wallet],
  );

  const claimPayout = useCallback(
    async (positionId: string) => {
      if (!wallet.account) {
        throw new Error("Connect wallet before claiming");
      }
      if (!wallet.address) {
        throw new Error("Wallet did not return a public key");
      }

      setIsTrading(true);
      setStatusMessage("Building claim transaction");

      try {
        const response = await apiRequest<TradeResponse>(
          `/api/v1/positions/${encodeURIComponent(positionId)}/claim`,
          {
            method: "POST",
            token,
            body: JSON.stringify({
              walletPubkey: wallet.address,
            }),
          },
        );

        const serialized = getSerializedTransaction(response);
        if (!serialized) {
          throw new Error("Claim API did not return a serialized transaction");
        }

        setStatusMessage("Simulating claim");
        const transaction = deserializeTransaction(serialized);
        const simulation =
          transaction instanceof VersionedTransaction
            ? await wallet.connection.simulateTransaction(transaction)
            : await wallet.connection.simulateTransaction(transaction);
        if (simulation.value.err) {
          throw new Error(`Simulation failed: ${JSON.stringify(simulation.value.err)}`);
        }

        setStatusMessage("Requesting wallet signature");
        const signature = await wallet.signAndSendTransaction(
          transaction,
          simulation.context.slot,
        );
        const txid = Array.isArray(signature) ? signature[0] : signature;
        setStatusMessage(`Submitted ${txid}`);
        return txid;
      } finally {
        setIsTrading(false);
      }
    },
    [token, wallet],
  );

  return {
    claimPayout,
    isTrading,
    openPosition,
    statusMessage,
  };
}

function getSerializedTransaction(response: TradeResponse) {
  const candidates = [
    response.transaction,
    response.serializedTransaction,
    response.tx,
    typeof response.data === "object" && response.data !== null
      ? (response.data as TradeResponse).transaction
      : undefined,
  ];

  return candidates.find((candidate): candidate is string => typeof candidate === "string");
}

function deserializeTransaction(serialized: string) {
  const bytes = Buffer.from(serialized, "base64");

  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

import { useState, useCallback } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { Transaction } from "@solana/web3.js";
import type { TradeOutcome, TradeStep, Position } from "../types";

interface UseJupiterPredictOptions {
  signTransaction: (tx: any) => Promise<any>;
  burnerPublicKey: string | null;
}

export function useJupiterPredict({
  signTransaction,
  burnerPublicKey,
}: UseJupiterPredictOptions) {
  const { connection } = useConnection();
  const [positions, setPositions] = useState<Position[]>([]);
  const [tradeStep, setTradeStep] = useState<TradeStep>("idle");
  const [tradeMessage, setTradeMessage] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isTrading, setIsTrading] = useState(false);
  const [isLoadingPositions, setIsLoadingPositions] = useState(false);

  /**
   * Open a prediction position.
   * Flow: build unsigned tx -> sign with burner -> send to Solana
   */
  const openPosition = useCallback(
    async (marketId: string, outcome: TradeOutcome, amount: number) => {
      if (!burnerPublicKey) {
        throw new Error("Private wallet not available");
      }

      setError(null);
      setIsTrading(true);

      try {
        // Step 1: Build unsigned transaction
        setTradeStep("building");
        setTradeMessage("Building prediction transaction...");

        const buildRes = await fetch("/api/jupiter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "trade",
            marketId,
            outcome,
            amount,
            walletPubkey: burnerPublicKey,
          }),
        });

        if (!buildRes.ok) {
          const err = await buildRes.json();
          throw new Error(err.error || "Failed to build transaction");
        }

        const { transaction: txBase64 } = await buildRes.json();

        // Step 2: Deserialize and sign with burner wallet
        setTradeStep("signing");
        setTradeMessage("Signing with private wallet...");

        const txBuffer = Buffer.from(txBase64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signedTx = await signTransaction(transaction);

        // Step 3: Submit to Solana
        setTradeStep("submitting");
        setTradeMessage("Submitting to Solana network...");

        const rawTx = signedTx.serialize();
        const txHash = await connection.sendRawTransaction(rawTx, {
          skipPreflight: false,
          preflightCommitment: "confirmed",
        });

        // Step 4: Confirm
        setTradeStep("confirming");
        setTradeMessage(`Confirming transaction: ${txHash.slice(0, 8)}...`);

        await connection.confirmTransaction(txHash, "confirmed");

        setTradeStep("complete");
        setTradeMessage(
          `Position opened privately. TX: ${txHash.slice(0, 8)}...${txHash.slice(-4)}`
        );

        // Refresh positions
        await fetchPositions();

        return txHash;
      } catch (err: any) {
        console.error("Trade failed:", err);
        setTradeStep("failed");
        setError(err.message || "Trade failed");
        setTradeMessage("");
        throw err;
      } finally {
        setIsTrading(false);
      }
    },
    [burnerPublicKey, signTransaction, connection]
  );

  /**
   * Fetch positions for the burner wallet.
   */
  const fetchPositions = useCallback(async () => {
    if (!burnerPublicKey) return;

    setIsLoadingPositions(true);
    try {
      const res = await fetch("/api/jupiter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "positions",
          walletPubkey: burnerPublicKey,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Fetch positions error:", err);
        return;
      }

      const data = await res.json();

      // Transform to our Position type
      const mapped: Position[] = (data.positions || []).map((p: any) => ({
        marketId: p.marketId || p.market_id || "",
        marketTitle: p.marketTitle || p.market_title || "Unknown Market",
        outcome: p.outcome === "YES" || p.outcome === "yes" ? "YES" : "NO",
        entryPrice: p.entryPrice || p.entry_price || 0,
        currentPrice: p.currentPrice || p.current_price || 0,
        amount: p.amount || 0,
        pnl: p.pnl || 0,
        pnlPercent: p.pnlPercent || p.pnl_percent || 0,
        resolved: p.resolved || false,
        claimable: p.claimable || false,
      }));

      setPositions(mapped);
    } catch (err) {
      console.error("Fetch positions failed:", err);
    } finally {
      setIsLoadingPositions(false);
    }
  }, [burnerPublicKey]);

  /**
   * Claim payout for a resolved position.
   */
  const claimPayout = useCallback(
    async (positionId: string) => {
      if (!burnerPublicKey) {
        throw new Error("Private wallet not available");
      }

      setError(null);
      setIsTrading(true);

      try {
        setTradeStep("building");
        setTradeMessage("Building claim transaction...");

        const res = await fetch("/api/jupiter", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "claim",
            positionId,
            walletPubkey: burnerPublicKey,
          }),
        });

        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || "Failed to build claim");
        }

        const { transaction: txBase64 } = await res.json();

        setTradeStep("signing");
        setTradeMessage("Signing claim with private wallet...");

        const txBuffer = Buffer.from(txBase64, "base64");
        const transaction = Transaction.from(txBuffer);
        const signedTx = await signTransaction(transaction);

        setTradeStep("submitting");
        setTradeMessage("Submitting claim...");

        const rawTx = signedTx.serialize();
        const txHash = await connection.sendRawTransaction(rawTx);
        await connection.confirmTransaction(txHash, "confirmed");

        setTradeStep("complete");
        setTradeMessage(`Payout claimed. TX: ${txHash.slice(0, 8)}...`);

        await fetchPositions();
        return txHash;
      } catch (err: any) {
        console.error("Claim failed:", err);
        setTradeStep("failed");
        setError(err.message || "Claim failed");
        throw err;
      } finally {
        setIsTrading(false);
      }
    },
    [burnerPublicKey, signTransaction, connection, fetchPositions]
  );

  /**
   * Reset trade state.
   */
  const resetTradeState = useCallback(() => {
    setTradeStep("idle");
    setTradeMessage("");
    setError(null);
  }, []);

  return {
    positions,
    tradeStep,
    tradeMessage,
    error,
    isTrading,
    isLoadingPositions,
    openPosition,
    fetchPositions,
    claimPayout,
    resetTradeState,
  };
}

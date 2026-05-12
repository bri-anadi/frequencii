import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { z } from "zod";

const DepositSchema = z.object({
  amount: z.number().min(0.01).max(10),
  walletPubkey: z.string().min(32).max(44),
});

/**
 * POST /api/v1/privacy/deposit
 * Proxy for PrivacyCash deposit to ZK shielded pool.
 * Server-side execution avoids WASM dependency in React Native.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    const parsed = DepositSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        400,
      );
    }

    const { amount, walletPubkey } = parsed.data;

    // TODO: Wire PrivacyCash SDK server-side
    // const privacyCash = await getPrivacyCashClient();
    // await privacyCash.signIn(walletPubkey);
    // const depositTx = await privacyCash.deposit(amount);

    // For now, return guarded response
    return jsonResponse({
      success: false,
      guarded: true,
      message: "PrivacyCash server-side bridge is staged. Deposit will execute once SDK is wired.",
      amount,
      walletPubkey,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Deposit failed";
    return jsonResponse({ error: message }, 500);
  }
}

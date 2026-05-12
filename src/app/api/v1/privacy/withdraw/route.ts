import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { jsonResponse } from "@/lib/api/cors";
import { z } from "zod";

const WithdrawSchema = z.object({
  amount: z.number().min(0.003).max(10),
  recipientPubkey: z.string().min(32).max(44),
});

/**
 * POST /api/v1/privacy/withdraw
 * Proxy for PrivacyCash withdrawal from ZK shielded pool to a target address.
 * Server-side execution avoids WASM dependency in React Native.
 */
export async function POST(request: NextRequest) {
  const auth = await withAuth(request);
  if (isAuthError(auth)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const body = await request.json();
    const parsed = WithdrawSchema.safeParse(body);

    if (!parsed.success) {
      return jsonResponse(
        { error: "Invalid request", details: parsed.error.flatten().fieldErrors },
        400,
      );
    }

    const { amount, recipientPubkey } = parsed.data;

    // TODO: Wire PrivacyCash SDK server-side
    // const privacyCash = await getPrivacyCashClient();
    // const withdrawTx = await privacyCash.withdraw(recipientPubkey, amount);

    // For now, return guarded response
    return jsonResponse({
      success: false,
      guarded: true,
      message: "PrivacyCash server-side bridge is staged. Withdrawal will execute once SDK is wired.",
      amount,
      recipientPubkey,
      estimatedFee: 0.007,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Withdrawal failed";
    return jsonResponse({ error: message }, 500);
  }
}

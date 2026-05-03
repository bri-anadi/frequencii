import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { buildTrade } from "@/lib/api/jupiter";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const body = await request.json();
    const { marketId, outcome, amount, walletPubkey } = body;

    if (!marketId || !outcome || !amount || !walletPubkey) {
      return jsonResponse(
        { error: "Required fields: marketId, outcome, amount, walletPubkey" },
        400,
        origin
      );
    }

    if (!["YES", "NO"].includes(outcome)) {
      return jsonResponse(
        { error: "outcome must be 'YES' or 'NO'" },
        400,
        origin
      );
    }

    const data = await buildTrade(marketId, outcome, amount, walletPubkey);

    return jsonResponse(data, 200, origin);
  } catch (error: any) {
    console.error("Trade error:", error);
    return jsonResponse(
      { error: "Failed to build trade", details: error.message },
      500,
      origin
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

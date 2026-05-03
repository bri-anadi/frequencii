import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { fetchPositions } from "@/lib/api/jupiter";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const walletPubkey = searchParams.get("walletPubkey");

    if (!walletPubkey) {
      return jsonResponse(
        { error: "walletPubkey query parameter is required" },
        400,
        origin
      );
    }

    const data = await fetchPositions(walletPubkey);

    return jsonResponse(data, 200, origin);
  } catch (error: any) {
    console.error("Positions error:", error);
    return jsonResponse(
      { error: "Failed to fetch positions", details: error.message },
      500,
      origin
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { claimPayout } from "@/lib/api/jupiter";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const body = await request.json();
    const { walletPubkey } = body;

    if (!walletPubkey) {
      return jsonResponse(
        { error: "walletPubkey is required" },
        400,
        origin
      );
    }

    const data = await claimPayout(id, walletPubkey);

    return jsonResponse(data, 200, origin);
  } catch (error: any) {
    console.error("Claim error:", error);
    return jsonResponse(
      { error: "Failed to claim payout", details: error.message },
      500,
      origin
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

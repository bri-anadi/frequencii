import { NextRequest } from "next/server";
import { withAuth, isAuthError, signJwt } from "@/lib/api/auth";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { pubkey } = authResult;
    const { token, expiresAt } = await signJwt(pubkey);

    return jsonResponse({ token, expiresAt }, 200, origin);
  } catch (error: any) {
    console.error("Refresh error:", error);
    return jsonResponse(
      { error: "Internal server error", details: error.message },
      500,
      origin
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

import { NextRequest } from "next/server";
import { isAuthError, withAuth } from "@/lib/api/auth";
import { handlePreflight, jsonResponse } from "@/lib/api/cors";
import { verifySeekerGenesisToken } from "@/lib/api/seeker";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const result = await verifySeekerGenesisToken(authResult.pubkey);
    return jsonResponse(result, 200, origin);
  } catch (error: any) {
    return jsonResponse(
      { error: "Failed to verify Seeker ownership", details: error.message },
      500,
      origin,
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

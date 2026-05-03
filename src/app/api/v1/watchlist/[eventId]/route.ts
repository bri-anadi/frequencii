import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { addToWatchlist, removeFromWatchlist } from "@/lib/api/db";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const origin = request.headers.get("origin");
  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;
    const { pubkey } = authResult;
    const { eventId } = await params;
    const added = addToWatchlist(pubkey, eventId);
    return jsonResponse({ added }, 200, origin);
  } catch (error: any) {
    return jsonResponse({ error: "Internal server error", details: error.message }, 500, origin);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ eventId: string }> }
) {
  const origin = request.headers.get("origin");
  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;
    const { pubkey } = authResult;
    const { eventId } = await params;
    const removed = removeFromWatchlist(pubkey, eventId);
    return jsonResponse({ removed }, 200, origin);
  } catch (error: any) {
    return jsonResponse({ error: "Internal server error", details: error.message }, 500, origin);
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

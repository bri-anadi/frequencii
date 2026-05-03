import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { getWatchlist } from "@/lib/api/db";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;
    const { pubkey } = authResult;
    const rows = getWatchlist(pubkey);
    const items = rows.map((r) => ({ eventId: r.event_id, addedAt: r.added_at }));
    return jsonResponse({ items }, 200, origin);
  } catch (error: any) {
    return jsonResponse({ error: "Internal server error", details: error.message }, 500, origin);
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

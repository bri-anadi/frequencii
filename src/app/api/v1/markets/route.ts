import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { fetchEvents } from "@/lib/api/jupiter";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category") || "All";
    const search = searchParams.get("search") || "";
    const limit = parseInt(searchParams.get("limit") || "20", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    const result = await fetchEvents({ category, search, limit, offset });

    return jsonResponse(result, 200, origin);
  } catch (error: any) {
    console.error("Markets list error:", error);
    return jsonResponse(
      { error: "Failed to fetch markets", details: error.message },
      500,
      origin
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

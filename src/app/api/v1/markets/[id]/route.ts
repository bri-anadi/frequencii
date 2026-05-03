import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { fetchEventById } from "@/lib/api/jupiter";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { id } = await params;
    const event = await fetchEventById(id);

    if (!event) {
      return jsonResponse({ error: "Event not found" }, 404, origin);
    }

    return jsonResponse({ event }, 200, origin);
  } catch (error: any) {
    console.error("Market detail error:", error);
    return jsonResponse(
      { error: "Failed to fetch market detail", details: error.message },
      500,
      origin
    );
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

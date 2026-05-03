import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { registerPushToken, removePushToken } from "@/lib/api/db";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;
    const { pubkey } = authResult;
    const body = await request.json();
    const { token, platform } = body;
    if (!token || !platform) {
      return jsonResponse({ error: "Required fields: token, platform" }, 400, origin);
    }
    if (!["android", "ios"].includes(platform)) {
      return jsonResponse({ error: "platform must be 'android' or 'ios'" }, 400, origin);
    }
    const registered = registerPushToken(pubkey, token, platform);
    return jsonResponse({ registered }, 200, origin);
  } catch (error: any) {
    return jsonResponse({ error: "Internal server error", details: error.message }, 500, origin);
  }
}

export async function DELETE(request: NextRequest) {
  const origin = request.headers.get("origin");
  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;
    const body = await request.json();
    const { token } = body;
    if (!token) {
      return jsonResponse({ error: "token is required" }, 400, origin);
    }
    const removed = removePushToken(token);
    return jsonResponse({ removed }, 200, origin);
  } catch (error: any) {
    return jsonResponse({ error: "Internal server error", details: error.message }, 500, origin);
  }
}

export async function OPTIONS(request: NextRequest) {
  return handlePreflight(request.headers.get("origin"));
}

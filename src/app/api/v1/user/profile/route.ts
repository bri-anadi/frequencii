import { NextRequest } from "next/server";
import { withAuth, isAuthError } from "@/lib/api/auth";
import { getUser, updateUser, upsertUser } from "@/lib/api/db";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export const runtime = "nodejs";

function formatUser(row: any) {
  return {
    pubkey: row.pubkey,
    displayName: row.display_name,
    avatar: row.avatar,
    createdAt: row.created_at,
  };
}

export async function GET(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { pubkey } = authResult;
    let user = getUser(pubkey);

    if (!user) {
      user = upsertUser(pubkey);
    }

    return jsonResponse(formatUser(user), 200, origin);
  } catch (error: any) {
    console.error("Profile GET error:", error);
    return jsonResponse(
      { error: "Internal server error", details: error.message },
      500,
      origin
    );
  }
}

export async function PUT(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const authResult = await withAuth(request);
    if (isAuthError(authResult)) return authResult;

    const { pubkey } = authResult;
    const body = await request.json();
    const { displayName, avatar } = body;

    const user = updateUser(pubkey, { displayName, avatar });

    if (!user) {
      return jsonResponse({ error: "User not found" }, 404, origin);
    }

    return jsonResponse(
      { updated: true, user: formatUser(user) },
      200,
      origin
    );
  } catch (error: any) {
    console.error("Profile PUT error:", error);
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

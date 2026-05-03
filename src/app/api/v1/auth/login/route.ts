import { NextRequest } from "next/server";
import { verifyWalletSignature, signJwt } from "@/lib/api/auth";
import { upsertUser } from "@/lib/api/db";
import { jsonResponse, handlePreflight } from "@/lib/api/cors";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const origin = request.headers.get("origin");

  try {
    const body = await request.json();
    const { pubkey, signature, message } = body;

    if (!pubkey || !signature || !message) {
      return jsonResponse(
        { error: "Missing required fields: pubkey, signature, message" },
        400,
        origin
      );
    }

    // Validate message format (should be "Frequencii Auth: {timestamp}")
    if (!message.startsWith("Frequencii Auth:")) {
      return jsonResponse(
        { error: "Invalid message format. Expected: 'Frequencii Auth: {timestamp}'" },
        400,
        origin
      );
    }

    // Check that the timestamp is not too old (5 minutes max)
    const timestampStr = message.split(":")[1]?.trim();
    const timestamp = parseInt(timestampStr, 10);
    if (isNaN(timestamp) || Date.now() - timestamp > 5 * 60 * 1000) {
      return jsonResponse(
        { error: "Message expired. Please sign a fresh message." },
        401,
        origin
      );
    }

    // Verify the wallet signature
    const isValid = verifyWalletSignature(pubkey, signature, message);
    if (!isValid) {
      return jsonResponse(
        { error: "Invalid wallet signature" },
        401,
        origin
      );
    }

    // Upsert user in database
    const userRow = upsertUser(pubkey);

    // Generate JWT
    const { token, expiresAt } = await signJwt(pubkey);

    return jsonResponse(
      {
        token,
        expiresAt,
        user: {
          pubkey: userRow.pubkey,
          displayName: userRow.display_name,
          avatar: userRow.avatar,
          createdAt: userRow.created_at,
        },
      },
      200,
      origin
    );
  } catch (error: any) {
    console.error("Login error:", error);
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

import { NextRequest } from "next/server";
import { SignJWT, jwtVerify, type JWTPayload } from "jose";
import nacl from "tweetnacl";
import bs58 from "bs58";
import { jsonResponse } from "./cors";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "frequencii-dev-secret-change-in-production"
);
const JWT_EXPIRY = "7d";
const JWT_ISSUER = "frequencii";

export interface AuthPayload extends JWTPayload {
  sub: string; // wallet pubkey
}

/**
 * Sign a JWT for a given wallet public key.
 */
export async function signJwt(pubkey: string): Promise<{ token: string; expiresAt: number }> {
  const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60; // 7 days

  const token = await new SignJWT({ sub: pubkey })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer(JWT_ISSUER)
    .setExpirationTime(JWT_EXPIRY)
    .sign(JWT_SECRET);

  return { token, expiresAt };
}

/**
 * Verify a JWT and return the payload.
 */
export async function verifyJwt(token: string): Promise<AuthPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
    });
    return payload as AuthPayload;
  } catch {
    return null;
  }
}

/**
 * Extract JWT token from Authorization header.
 */
export function extractToken(request: NextRequest): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

/**
 * Verify a Solana wallet signature.
 * The message should have been signed by the wallet's private key.
 */
export function verifyWalletSignature(
  pubkey: string,
  signature: string,
  message: string
): boolean {
  try {
    const publicKeyBytes = bs58.decode(pubkey);
    const signatureBytes = bs58.decode(signature);
    const messageBytes = new TextEncoder().encode(message);

    return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
  } catch {
    return false;
  }
}

/**
 * Auth middleware — extracts and verifies JWT from request.
 * Returns pubkey on success, or a 401 response on failure.
 */
export async function withAuth(
  request: NextRequest
): Promise<{ pubkey: string } | NextResponse> {
  const token = extractToken(request);
  if (!token) {
    return jsonResponse(
      { error: "Missing Authorization header" },
      401,
      request.headers.get("origin")
    );
  }

  const payload = await verifyJwt(token);
  if (!payload?.sub) {
    return jsonResponse(
      { error: "Invalid or expired token" },
      401,
      request.headers.get("origin")
    );
  }

  return { pubkey: payload.sub };
}

// Type guard to check if withAuth returned an error response
type NextResponse = import("next/server").NextResponse;

export function isAuthError(result: { pubkey: string } | NextResponse): result is NextResponse {
  return !("pubkey" in result);
}

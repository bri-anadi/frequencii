import { NextResponse } from "next/server";

const ALLOWED_ORIGINS = [
  "http://localhost:3000",
  "https://frequencii.world",
];

/**
 * Build CORS headers for API responses.
 */
export function corsHeaders(origin?: string | null): Record<string, string> {
  const allowedOrigin =
    origin && ALLOWED_ORIGINS.includes(origin) ? origin : "*";

  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":
      "Content-Type, Authorization, X-Requested-With",
    "Access-Control-Max-Age": "86400",
  };
}

/**
 * Wrap a NextResponse with CORS headers.
 */
export function withCors(response: NextResponse, origin?: string | null): NextResponse {
  const headers = corsHeaders(origin);
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }
  return response;
}

/**
 * Create a JSON response with CORS headers.
 */
export function jsonResponse(
  data: any,
  status: number = 200,
  origin?: string | null
): NextResponse {
  const response = NextResponse.json(data, { status });
  return withCors(response, origin);
}

/**
 * Handle CORS preflight (OPTIONS) request.
 */
export function handlePreflight(origin?: string | null): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(origin),
  });
}

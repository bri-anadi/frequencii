import { NextResponse } from "next/server";
import { getOpenApiSpec } from "@/lib/api/openapi";
import { corsHeaders } from "@/lib/api/cors";

export async function GET(request: Request) {
  const origin = request.headers.get("origin");
  const spec = getOpenApiSpec();

  return NextResponse.json(spec, {
    headers: {
      ...corsHeaders(origin),
      "Cache-Control": "public, max-age=3600",
    },
  });
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

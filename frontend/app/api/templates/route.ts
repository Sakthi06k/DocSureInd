import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    return NextResponse.json({ detail: "Backend API is not configured" }, { status: 500 });
  }

  const { searchParams } = new URL(request.url);
  const includeDrafts = searchParams.get("include_drafts") === "true";

  try {
    const response = await fetch(`${apiUrl}/api/v1/templates?include_drafts=${includeDrafts}`, {
      method: "GET",
      cache: "no-store",
    });

    if (response.ok) {
      const body = await response.json();
      return NextResponse.json(body, { status: 200 });
    }

    return NextResponse.json({ detail: "Failed to retrieve templates" }, { status: response.status });
  } catch (err) {
    return NextResponse.json({ detail: "Unable to contact templates service" }, { status: 502 });
  }
}

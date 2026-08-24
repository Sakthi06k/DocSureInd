import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    return NextResponse.json({ detail: "Backend API is not configured" }, { status: 500 });
  }

  try {
    const payload = await request.json();
    const response = await fetch(`${apiUrl}/api/v1/assistant/query`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const body = await response.json();
    return NextResponse.json(body, { status: response.status });
  } catch (err) {
    return NextResponse.json({ detail: "Unable to contact assistant service" }, { status: 502 });
  }
}

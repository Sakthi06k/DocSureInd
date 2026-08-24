import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  const apiUrl = process.env.API_URL;

  if (!apiUrl) {
    return NextResponse.json(
      { detail: "Backend API is not configured" },
      { status: 500 }
    );
  }

  try {
    const body = await request.json();

    const response = await fetch(
      `${apiUrl}/api/v1/translate`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        cache: "no-store",
      }
    );

    const result = await response.json();

    return NextResponse.json(result, {
      status: response.status,
    });
  } catch (err) {
    return NextResponse.json(
      { detail: "Translation service is unavailable" },
      { status: 502 }
    );
  }
}

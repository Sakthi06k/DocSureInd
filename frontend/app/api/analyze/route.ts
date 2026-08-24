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
    const formData = await request.formData();

    const response = await fetch(
      `${apiUrl}/api/v1/analyze`,
      {
        method: "POST",
        body: formData,
        cache: "no-store",
      }
    );

    const contentType =
      response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const body = await response.json();

      return NextResponse.json(body, {
        status: response.status,
      });
    }

    return NextResponse.json(
      {
        detail: response.ok
          ? "Unexpected backend response"
          : "Document verification failed",
      },
      { status: response.status }
    );
  } catch (err) {
    return NextResponse.json(
      {
        detail:
          "Unable to contact the verification service. Your files were not saved.",
      },
      { status: 502 }
    );
  }
}

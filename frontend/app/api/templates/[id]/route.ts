import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiUrl = process.env.API_URL;
  if (!apiUrl) {
    return NextResponse.json({ detail: "Backend API is not configured" }, { status: 500 });
  }

  const { id } = await params;

  try {
    const response = await fetch(`${apiUrl}/api/v1/templates/${id}`, {
      method: "GET",
      cache: "no-store",
    });

    if (response.ok) {
      const body = await response.json();
      return NextResponse.json(body, { status: 200 });
    }

    return NextResponse.json({ detail: "Template not found" }, { status: response.status });
  } catch (err) {
    return NextResponse.json({ detail: "Unable to contact templates service" }, { status: 502 });
  }
}

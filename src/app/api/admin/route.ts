import { NextRequest, NextResponse } from "next/server";

// Simple password-based admin auth
export async function POST(request: NextRequest) {
  let body: { password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, error: "Invalid request" }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return NextResponse.json({ success: false, error: "Admin not configured" }, { status: 503 });
  }

  if (body.password === adminPassword) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: "Wrong password" }, { status: 401 });
}

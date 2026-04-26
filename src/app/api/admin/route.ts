import { NextRequest, NextResponse } from "next/server";

// Simple password-based admin auth
export async function POST(request: NextRequest) {
  const { password } = await request.json();
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";

  if (password === adminPassword) {
    return NextResponse.json({ success: true });
  }
  return NextResponse.json({ success: false, error: "Wrong password" }, { status: 401 });
}

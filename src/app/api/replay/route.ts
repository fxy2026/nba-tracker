import { NextRequest, NextResponse } from "next/server";
import { addReplayLink, deleteReplayLink, getReplayLinks } from "@/lib/supabase";

function checkAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("x-admin-password");
  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  return authHeader === adminPassword;
}

export async function GET(request: NextRequest) {
  const gameId = request.nextUrl.searchParams.get("game_id");
  if (!gameId) {
    return NextResponse.json({ error: "game_id required" }, { status: 400 });
  }
  const links = await getReplayLinks(gameId);
  return NextResponse.json({ data: links });
}

export async function POST(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { game_id, title, url, source } = await request.json();
  if (!game_id || !title || !url) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const link = await addReplayLink(game_id, title, url, source || "cloud");
  if (!link) {
    return NextResponse.json({ error: "Failed to add" }, { status: 500 });
  }
  return NextResponse.json({ data: link });
}

export async function DELETE(request: NextRequest) {
  if (!checkAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  const ok = await deleteReplayLink(id);
  return NextResponse.json({ success: ok });
}

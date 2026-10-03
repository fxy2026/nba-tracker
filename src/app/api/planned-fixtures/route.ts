import { NextResponse } from 'next/server';
import { parsePlannedFixtureQuery } from '@/lib/planned-fixtures';
import { getPlannedFixtureView } from '@/lib/planned-fixtures-server';

export async function GET(request: Request) {
  const query = parsePlannedFixtureQuery(new URL(request.url).searchParams);
  if (!query) return NextResponse.json({ error: 'Use exactly one valid date, month, or from, a valid timezone and optional team; upcoming limit is 1–20.' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  // Pure local snapshot endpoint. Existing pages decide whether to use this
  // fallback from the canonical data they already fetched, never another cold
  // upstream request. This source-only response does not claim live coverage.
  return NextResponse.json(getPlannedFixtureView(query, [], null), {
    headers: { 'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600' },
  });
}

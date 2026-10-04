import { collectAnalyticsPageview } from "@/lib/visitor-analytics-server";
export const runtime = "nodejs";
export const maxDuration = 10;
export async function POST(request: Request): Promise<Response> {
  return collectAnalyticsPageview(request);
}

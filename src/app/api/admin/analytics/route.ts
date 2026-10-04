import { analyticsResponse, getVisitorAnalyticsReport, isAnalyticsAdmin, parseAnalyticsDays } from "@/lib/visitor-analytics-server";
export const runtime = "nodejs";
export const maxDuration = 10;
export async function GET(request: Request): Promise<Response> {
  if (!isAnalyticsAdmin(request)) return analyticsResponse({ error: "Unauthorized" }, 401);
  const days = parseAnalyticsDays(request.url);
  if (days === null) return analyticsResponse({ error: "days must be 7 or 30" }, 400);
  const report = await getVisitorAnalyticsReport(days);
  return analyticsResponse(report, report.status === "unavailable" ? 503 : 200);
}

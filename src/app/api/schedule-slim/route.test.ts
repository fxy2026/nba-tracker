import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api", () => ({ getCachedScheduleFeed: vi.fn() }));

import { GET } from "./route";
import { getCachedScheduleFeed } from "@/lib/api";

beforeEach(() => {
  vi.mocked(getCachedScheduleFeed).mockReset();
});

describe("GET /api/schedule-slim", () => {
  it("serves a non-empty feed with the long shared-cache header", async () => {
    vi.mocked(getCachedScheduleFeed).mockResolvedValue({
      seasonYear: "2025",
      dates: [{ gameDate: "10/21/2025 00:00:00", games: [] }],
    });

    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("public, s-maxage=7200, stale-while-revalidate=86400");
    const body = await res.json();
    expect(body.seasonYear).toBe("2025");
    expect(body.dates).toHaveLength(1);
  });

  it("returns 503 no-store when the feed is empty so CDNs never cache it", async () => {
    vi.mocked(getCachedScheduleFeed).mockResolvedValue({ seasonYear: "", dates: [] });

    const res = await GET();
    expect(res.status).toBe(503);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });
});

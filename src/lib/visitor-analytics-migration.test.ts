/** Offline contract checks; these do not execute SQL or prove hosted permissions. */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ANALYTICS_PATH_KEYS } from "./visitor-analytics";

const migration = "supabase/migrations/20261004103147_create_private_visitor_analytics.sql";
const sql = readFileSync(migration, "utf8");

it("preserves the exact applied migration bytes under its returned version", () => {
  expect(createHash("sha256").update(sql).digest("hex")).toBe("e45d19f6ea5062e7f3ef4443a0c2c7bd29f5db1ac2d993dc0896799abad0ef23");
  expect(sql).not.toMatch(/\bDROP\b|\bSECURITY DEFINER\b/i);
  expect(sql).not.toMatch(/(?:ALTER|UPDATE|DELETE FROM|INSERT INTO)\s+(?:public\.)?replay_links/i);
  for (const table of ["state", "daily", "event_ids", "browsers", "dimensions"])
    expect(sql).toContain(`ALTER TABLE visitor_analytics.${table} ENABLE ROW LEVEL SECURITY`);
  expect(sql.match(/SECURITY INVOKER SET search_path = '' SET lock_timeout = '1s'/g)).toHaveLength(3);
  expect(sql).toContain("REVOKE ALL ON FUNCTION public.visitor_analytics_collect(uuid, text, text, text, text, date) FROM PUBLIC, anon, authenticated");
  expect(sql).toContain("REVOKE ALL ON FUNCTION public.visitor_analytics_report(date, date) FROM PUBLIC, anon, authenticated");
});

it("keeps the applied path vocabulary and state-before-daily lock order", () => {
  const list = sql.match(/p_path = ANY \(ARRAY\[([\s\S]*?)\]\)/)?.[1] ?? "";
  expect([...list.matchAll(/'([^']+)'/g)].map(match => match[1]).sort()).toEqual([...ANALYTICS_PATH_KEYS].sort());
  const collect = sql.slice(sql.indexOf("CREATE FUNCTION public.visitor_analytics_collect"));
  expect(collect.indexOf("FROM visitor_analytics.state WHERE singleton = true FOR UPDATE"))
    .toBeLessThan(collect.indexOf("SELECT page_views INTO v_pv FROM visitor_analytics.daily"));
  expect(collect).toContain("IF v_pv >= 50000 THEN");
  expect(collect).toContain("IF v_browser_pv >= 1000 THEN");
});

it("records bounded, database-local cleanup with no HTTP or embedded credential", () => {
  expect(sql).toContain("DELETE FROM visitor_analytics.event_ids WHERE day < v_today - 1");
  expect(sql).toContain("DELETE FROM visitor_analytics.daily WHERE day < v_today - 89");
  expect(sql).toContain("'15 16 * * *'");
  expect(sql).toContain("SET statement_timeout = '30s'");
  expect(sql).toContain("AND end_time < statement_timestamp() - interval '7 days'");
  expect(sql).not.toMatch(/net\.http|https?:\/\/|sb_secret_|Authorization|Bearer/i);
});

it("separates the applied SQL record from unverified HTTP and concurrency gates", () => {
  const status = readFileSync("docs/design/visitor-analytics-deployment.md", "utf8");
  expect(status).toContain("../../" + migration);
  expect(status).toContain("First-party collection remains disabled");
  expect(status).toContain("No hosted HTTP RPC tests have been completed");
  expect(status).toContain("Multi-session contention is therefore **unverified**");
  expect(status).toContain("No passing concurrency or HTTP result is claimed");
  expect(status).toContain("2026-10-04 10:42:00 UTC");
});

/** Static proposal checks only. These are NOT proof of DB execution/RLS/concurrency. */
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { ANALYTICS_PATH_KEYS } from "./visitor-analytics";
const sql = readFileSync("docs/design/visitor-analytics-proposed.sql", "utf8");
it("keeps SQL only additive, all tables RLS protected and RPCs invoker-only", () => {
  expect(sql).not.toMatch(/\bDROP\b|\bSECURITY DEFINER\b/i);
  expect(sql).not.toMatch(/(?:ALTER|UPDATE|DELETE FROM|INSERT INTO)\s+(?:public\.)?replay_links/i);
  for (const table of ["state", "daily", "event_ids", "browsers", "dimensions"]) expect(sql).toContain(`ALTER TABLE visitor_analytics.${table} ENABLE ROW LEVEL SECURITY`);
  expect(sql.match(/SECURITY INVOKER SET search_path = ''/g)).toHaveLength(3);
  expect(sql).toContain("FROM PUBLIC, anon, authenticated");
  expect(sql).toContain("REVOKE ALL ON FUNCTION public.visitor_analytics_collect(uuid, text, text, text, text, date) FROM PUBLIC, anon, authenticated");
  expect(sql).toContain("REVOKE ALL ON FUNCTION public.visitor_analytics_report(date, date) FROM PUBLIC, anon, authenticated");
});
it("SQL and client share the exact finite route-key vocabulary", () => {
  const list = sql.match(/p_path = ANY \(ARRAY\[([\s\S]*?)\]\)/)?.[1] ?? "";
  const values = [...list.matchAll(/'([^']+)'/g)].map(match => match[1]);
  expect(values.sort()).toEqual([...ANALYTICS_PATH_KEYS].sort());
});
it("durable retry and cap guards precede counter increments in one transaction", () => {
  expect(sql).toContain("event_id uuid PRIMARY KEY");
  expect(sql).toContain("SELECT page_views INTO v_pv FROM visitor_analytics.daily WHERE day = v_day FOR UPDATE");
  expect(sql.indexOf("IF v_inserted = 0 THEN RETURN 'duplicate'")).toBeLessThan(sql.indexOf("SET page_views = page_views + 1,"));
  expect(sql).toContain("IF v_pv >= 50000 THEN");
  expect(sql).toContain("p_to - p_from + 1) NOT IN (7, 30)");
  expect(sql).toContain("DELETE FROM visitor_analytics.event_ids WHERE day < v_today - 1");
});

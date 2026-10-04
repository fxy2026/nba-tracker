"use client";

import { useEffect, useId, useRef, useState } from "react";
import { BarChart3, CalendarDays, ChevronDown, Database, Eye, Info, Monitor, RefreshCw, ShieldCheck, Users, Waypoints } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { AdminRequestError, createLatestRequest, readAdminResponse, fetchAdmin, adminErrorText } from "./admin-client";
import styles from "../admin.module.css";

import type { VisitorAnalyticsReport } from "@/lib/visitor-analytics";
export type VisitorAnalytics = VisitorAnalyticsReport;

type LoadState = { kind: "loading" } | { kind: "error"; message: string } | { kind: "data"; data: VisitorAnalytics };

const numeric = (value: unknown) => typeof value === "number" && Number.isFinite(value) && value >= 0;
const nullableNumeric = (value: unknown) => value === null || numeric(value);

/** Refuse incomplete success payloads rather than quietly manufacturing zeros. */
export function validAnalytics(value: VisitorAnalytics): boolean {
  if (!value || !["ready", "unconfigured", "unavailable"].includes(value.status)
    || value.timezone !== "Asia/Shanghai" || !value.range || ![7, 30].includes(value.range.days)) return false;
  if (value.status !== "ready") return true;
  return !!value.today && !!value.period
    && numeric(value.today.pageViews) && nullableNumeric(value.today.visitors)
    && numeric(value.period.pageViews) && nullableNumeric(value.period.avgDailyVisitors)
    && numeric(value.period.identifiedPageViews) && numeric(value.period.observedDays)
    && Array.isArray(value.series) && value.series.every(row => /^\d{4}-\d{2}-\d{2}$/.test(row.date) && numeric(row.pageViews) && nullableNumeric(row.visitors))
    && Array.isArray(value.pages) && value.pages.every(row => typeof row.path === "string" && numeric(row.pageViews))
    && Array.isArray(value.referrers) && value.referrers.every(row => typeof row.source === "string" && numeric(row.pageViews))
    && Array.isArray(value.devices) && value.devices.every(row => typeof row.device === "string" && numeric(row.pageViews));
}

export default function AnalyticsOverview({ password, onUnauthorized }: { password: string; onUnauthorized: () => void }) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [days, setDays] = useState<7 | 30>(7);
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState<LoadState>({ kind: "loading" });
  const requestGate = useRef(createLatestRequest());
  const unauthorizedRef = useRef(onUnauthorized);
  useEffect(() => { unauthorizedRef.current = onUnauthorized; }, [onUnauthorized]);

  useEffect(() => {
    const gate = requestGate.current;
    const request = gate.begin();
    async function load() {
      setState({ kind: "loading" });
      try {
        const response = await fetchAdmin(`/api/admin/analytics?days=${days}`, {
          headers: { "x-admin-password": password }, signal: request.signal, cache: "no-store",
        });
        const data = response.status === 503
          ? await response.json() as VisitorAnalytics
          : await readAdminResponse<VisitorAnalytics>(response);
        if (!validAnalytics(data) || data.range.days !== days) throw new Error(zh ? "统计响应不完整，请重试。" : "The analytics response was incomplete. Please retry.");
        if (gate.current(request)) setState({ kind: "data", data });
      } catch (error) {
        if (!gate.current(request)) return;
        if (error instanceof AdminRequestError && error.status === 401) { unauthorizedRef.current(); return; }
        setState({ kind: "error", message: adminErrorText(error, zh, zh ? "无法加载统计，请检查网络后重试。" : "Couldn't load analytics. Check your connection and retry.") });
      }
    }
    void load();
    return () => gate.cancel();
  }, [days, password, refresh, zh]);

  function changeRange(next: 7 | 30) {
    if (next === days) return;
    requestGate.current.cancel();
    setState({ kind: "loading" });
    setDays(next);
  }
  function reload() {
    requestGate.current.cancel();
    setState({ kind: "loading" });
    setRefresh(value => value + 1);
  }

  return <div className={styles.stack}>
    <div className={styles.toolbar}>
      <div><h2 className={styles.sectionTitle}>{zh ? "访问概览" : "Audience overview"}</h2><p className={styles.caption}>{zh ? "从真实浏览记录，了解网站的使用情况。" : "A clear view of how your site is being used."}</p></div>
      <div className={styles.toolbarActions}>
        <div className={styles.range} aria-label={zh ? "统计时间范围" : "Analytics period"}>
          {([7, 30] as const).map(value => <button key={value} type="button" aria-pressed={value === days} onClick={() => changeRange(value)}>{zh ? `近 ${value} 天` : `${value} days`}</button>)}
        </div>
        <button type="button" className={styles.iconButton} disabled={state.kind === "loading"} onClick={reload} aria-label={zh ? "刷新访问统计" : "Refresh analytics"}><RefreshCw size={16} className={state.kind === "loading" ? styles.spin : undefined} /></button>
      </div>
    </div>
    {state.kind === "loading" ? <AnalyticsSkeleton zh={zh} /> : state.kind === "error" ? <div className={styles.status} role="alert">
      <div className={styles.statusIcon}><BarChart3 size={22} /></div><h3>{zh ? "暂时无法读取统计" : "Analytics couldn't be loaded"}</h3><p>{state.message}</p><button className={styles.button} type="button" onClick={reload}><RefreshCw size={14} />{zh ? "重试" : "Try again"}</button>
    </div> : <AnalyticsContent data={state.data} zh={zh} onRetry={reload} />}
  </div>;
}

export function AnalyticsSkeleton({ zh }: { zh: boolean }) {
  return <div className={styles.stack} role="status" aria-label={zh ? "正在加载访问统计" : "Loading analytics"}>
    <span className={styles.srOnly}>{zh ? "正在加载访问统计…" : "Loading analytics…"}</span>
    <div className={styles.metrics} aria-hidden="true">{[0, 1, 2, 3].map(key => <div key={key} className={styles.metric}><div className={styles.skeleton} style={{ height: 11, width: "60%" }} /><div className={styles.skeleton} style={{ height: 32, width: "48%", margin: "20px 0 12px" }} /><div className={styles.skeleton} style={{ height: 9, width: "75%" }} /></div>)}</div>
    <div className={styles.card} aria-hidden="true"><div className={styles.skeleton} style={{ width: 120, height: 14, marginBottom: 28 }} /><div className={styles.skeleton} style={{ height: 224, opacity: .45 }} /></div>
  </div>;
}

function Metric({ label, value, note, icon }: { label: string; value: string; note: string; icon: React.ReactNode }) {
  return <div className={styles.metric}><p className={styles.metricLabel}>{label}{icon}</p><p className={styles.metricValue}>{value}</p><p className={styles.metricNote}>{note}</p></div>;
}

function formatTimestamp(value: string | null, zh: boolean): string | null {
  if (!value || !Number.isFinite(Date.parse(value))) return null;
  return new Intl.DateTimeFormat(zh ? "zh-CN" : "en-GB", { timeZone: "Asia/Shanghai", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

export function AnalyticsContent({ data, zh, onRetry }: { data: VisitorAnalytics; zh: boolean; onRetry: () => void }) {
  const ready = data.status === "ready";
  const number = (value: number | null | undefined, decimals = 0) => value == null ? "—" : new Intl.NumberFormat(zh ? "zh-CN" : "en-US", { maximumFractionDigits: decimals }).format(value);
  const period = ready ? data.period : null;
  const today = ready ? data.today : null;
  const noIdentity = period?.avgDailyVisitors == null;
  const collectedAt = formatTimestamp(data.collectedSince, zh);
  const updatedAt = formatTimestamp(data.generatedAt, zh);
  const rangeLabel = `${data.range.from} – ${data.range.to}`;
  const coverage = period && period.pageViews > 0 ? Math.min(100, Math.round(period.identifiedPageViews / period.pageViews * 100)) : null;

  return <>
    {!ready && <div className={styles.status} role={data.status === "unavailable" ? "alert" : "status"}>
      <div className={styles.statusIcon}><Database size={23} /></div>
      <h3>{data.status === "unconfigured" ? (zh ? "访问统计尚未接入" : "Visitor analytics isn't connected yet") : (zh ? "统计服务暂时不可用" : "Analytics is temporarily unavailable")}</h3>
      <p>{data.status === "unconfigured" ? (zh ? "统计存储尚未配置。接入后，这里会展示真实的浏览趋势、热门页面和来源；不会补写过去的数据。" : "Analytics storage hasn't been configured. Once connected, this space will show real traffic trends, top pages, and sources. Past visits cannot be backfilled.") : (zh ? "暂时无法读取已保存的统计。未将读取失败显示为零次访问，请稍后重试。" : "Stored analytics couldn't be read. A failed request doesn't mean zero visits. Please try again shortly.")}</p>
      <button type="button" onClick={onRetry} className={styles.button}><RefreshCw size={14} />{zh ? "重新检查" : "Check again"}</button>
    </div>}
    <div className={styles.metrics}>
      <Metric label={zh ? "页面浏览量" : "Page views"} value={number(period?.pageViews)} note={zh ? `近 ${data.range.days} 天 · 含今日` : `Last ${data.range.days} days · includes today`} icon={<Eye size={15} />} />
      <Metric label={zh ? "日均浏览器 · 已同意" : "Daily browsers · opted in"} value={number(period?.avgDailyVisitors, 1)} note={noIdentity ? (zh ? "尚无已同意统计的浏览器数据" : "No opted-in browser data yet") : (zh ? "按已有记录的天数计算" : "Average per observed day")} icon={<Users size={15} />} />
      <Metric label={zh ? "今日浏览量" : "Views today"} value={number(today?.pageViews)} note={zh ? "北京时间 · 今日尚未结束" : "Shanghai time · day in progress"} icon={<CalendarDays size={15} />} />
      <Metric label={zh ? "今日浏览器 · 已同意" : "Browsers today · opted in"} value={number(today?.visitors)} note={zh ? "浏览器数不等于人数" : "Browsers are not people"} icon={<Monitor size={15} />} />
    </div>
    {ready && <>
      <section className={styles.card} aria-labelledby="admin-traffic-title">
        <div className={styles.cardHeader}><div><h3 id="admin-traffic-title" className={styles.cardTitle}><BarChart3 size={16} />{zh ? "每日访问趋势" : "Daily traffic"}</h3><p className={styles.caption}>{rangeLabel} · UTC+8</p></div><div className={styles.legend}><span><i />{zh ? "页面浏览量" : "Page views"}</span>{!noIdentity && <span><i className={styles.secondaryDot} />{zh ? "已同意的浏览器" : "Opted-in browsers"}</span>}</div></div>
        {period?.pageViews === 0 ? <div className={styles.emptySmall}>{zh ? "这段时间还没有记录到页面浏览。采集到数据后，趋势会显示在这里。" : "No page views have been recorded in this period. Your traffic trend will appear here as data arrives."}</div> : <TrafficChart series={data.series ?? []} zh={zh} />}
      </section>
      <div className={styles.breakdowns}>
        <Ranking title={zh ? "热门页面" : "Top pages"} detail={zh ? "按页面浏览量排序" : "Ranked by page views"} icon={<Eye size={15} />} items={(data.pages ?? []).map(item => ({ label: item.path, count: item.pageViews }))} zh={zh} />
        <Ranking title={zh ? "访问来源" : "Traffic sources"} detail={zh ? "来源类别 · 按浏览量" : "Source categories · page views"} icon={<Waypoints size={15} />} items={(data.referrers ?? []).map(item => ({ label: sourceLabel(item.source, zh), count: item.pageViews }))} zh={zh} />
        <Ranking title={zh ? "屏幕尺寸" : "Screen sizes"} detail={zh ? "屏幕类别 · 非设备型号" : "Viewport groups · not device models"} icon={<Monitor size={15} />} items={(data.devices ?? []).map(item => ({ label: deviceLabel(item.device, zh), count: item.pageViews }))} zh={zh} />
      </div>
      {data.limited && <div className={styles.error} role="status">{zh ? "已达到每日采集上限，部分浏览未计入，统计可能不完整。" : "The daily collection limit was reached. Some views were not counted, so these figures may be incomplete."}</div>}
      <div className={styles.note}><ShieldCheck size={15} /><p>{zh ? "浏览量记录页面打开次数。浏览器统计仅包含明确同意统计的浏览器，每个北京时间自然日去重；同一浏览器跨日会重复计入，不代表人数。" : "Page views count page openings. Browser counts include only explicitly opted-in browsers, deduplicated per Shanghai calendar day. The same browser can count again on another day; these are not people."}{coverage !== null && ` ${zh ? "可用于浏览器去重的浏览量占比" : "Views with a usable opted-in identity"}: ${coverage}%.`}{zh ? ` 日均值按已开始采集的 ${period?.observedDays ?? 0} 天计算；今日尚未结束，采集前的日期不补记。` : ` Daily averages use ${period?.observedDays ?? 0} observed days. Today is incomplete; dates before collection started are not backfilled.`}</p></div>
    </>}
    <div className={styles.note}><Info size={14} /><p>{collectedAt ? (zh ? `最早记录：${collectedAt}。` : `First recorded view: ${collectedAt}. `) : ready ? (zh ? "尚无历史采集记录。" : "No collection history yet. ") : (zh ? "采集历史暂不可用。" : "Collection history unavailable. ")}{updatedAt ? (zh ? ` 读取时间：${updatedAt}。` : ` Retrieved: ${updatedAt}. `) : ""}{zh ? "统计时间统一为北京时间（UTC+8）。" : "All analytics use Shanghai time (UTC+8)."}</p></div>
  </>;
}

export function chartPoints(series: NonNullable<VisitorAnalytics["series"]>) {
  const max = Math.max(1, ...series.flatMap(item => [item.pageViews, item.visitors ?? 0]));
  const width = 720;
  const height = 176;
  return { max, points: series.map((item, index) => ({ ...item, x: 38 + (series.length === 1 ? width / 2 : index * width / (series.length - 1)), y: 196 - item.pageViews / max * height, visitorY: item.visitors == null ? null : 196 - item.visitors / max * height })) };
}

function TrafficChart({ series, zh }: { series: NonNullable<VisitorAnalytics["series"]>; zh: boolean }) {
  const id = useId();
  const { max, points } = chartPoints(series);
  const viewPath = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
  const segments: string[] = [];
  let previousWasValid = false;
  for (const point of points) {
    if (point.visitorY == null) { previousWasValid = false; continue; }
    segments.push(`${previousWasValid ? "L" : "M"}${point.x},${point.visitorY}`);
    previousWasValid = true;
  }
  const ticks = [0, Math.ceil(max / 2), max].filter((value, index, values) => values.indexOf(value) === index);
  const labels = series.length > 2 ? [series[0].date, series[Math.floor((series.length - 1) / 2)].date, series[series.length - 1].date] : series.map(item => item.date);
  return <>
    <div className={styles.chart}>
      <svg viewBox="0 0 776 214" role="img" aria-labelledby={`${id}-title ${id}-description`} preserveAspectRatio="none">
        <title id={`${id}-title`}>{zh ? "每日页面浏览量与已同意统计的浏览器数" : "Daily page views and opted-in browsers"}</title><desc id={`${id}-description`}>{zh ? "下方展开每日明细可读取图表中的准确数值。" : "Expand the daily data below for the exact values shown in this chart."}</desc>
        <defs><linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--accent)" stopOpacity=".18" /><stop offset="100%" stopColor="var(--accent)" stopOpacity=".01" /></linearGradient></defs>
        {ticks.map(tick => { const y = 196 - tick / max * 176; return <g key={tick}><line x1="38" x2="758" y1={y} y2={y} stroke="var(--border)" strokeDasharray={tick === 0 ? undefined : "3 5"} /><text x="27" y={y + 3} fill="var(--text-secondary)" fontSize="10" textAnchor="end">{Intl.NumberFormat(zh ? "zh-CN" : "en-US", { notation: "compact", maximumFractionDigits: 1 }).format(tick)}</text></g>; })}
        {points.length > 0 && <><path d={`${viewPath} L${points[points.length - 1].x},196 L${points[0].x},196 Z`} fill={`url(#${id}-fill)`} /><path d={viewPath} stroke="var(--accent)" strokeWidth="2.5" fill="none" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" /><path d={segments.join(" ")} stroke="var(--accent-amber)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" strokeLinecap="round" /></>}
        {points.map(point => <g key={point.date}><circle cx={point.x} cy={point.y} r={points.length > 10 ? 2 : 3} fill="var(--accent)"><title>{point.date}: {point.pageViews} {zh ? "浏览量" : "page views"}</title></circle>{point.visitorY != null && <circle cx={point.x} cy={point.visitorY} r="2.5" fill="var(--accent-amber)"><title>{point.date}: {point.visitors} {zh ? "已同意的浏览器" : "opted-in browsers"}</title></circle>}</g>)}
      </svg>
      <div className={styles.chartLabels}>{labels.map(date => <span key={date}>{date.slice(5).replace("-", "/")}</span>)}</div>
    </div>
    <details className={styles.chartDetails}><summary><ChevronDown size={14} />{zh ? "查看每日明细" : "View daily data"}</summary><div className={styles.tableWrap}><table className={styles.table}><caption className={styles.srOnly}>{zh ? "每日访问数据，北京时间" : "Daily traffic in Shanghai time"}</caption><thead><tr><th scope="col">{zh ? "日期" : "Date"}</th><th scope="col">{zh ? "浏览量" : "Page views"}</th><th scope="col">{zh ? "已同意的浏览器" : "Opted-in browsers"}</th></tr></thead><tbody>{series.map(row => <tr key={row.date}><th scope="row">{row.date}</th><td>{row.pageViews.toLocaleString()}</td><td>{row.visitors == null ? "—" : row.visitors.toLocaleString()}</td></tr>)}</tbody></table></div></details>
  </>;
}

function Ranking({ title, detail, icon, items, zh }: { title: string; detail: string; icon: React.ReactNode; items: { label: string; count: number }[]; zh: boolean }) {
  const max = Math.max(1, ...items.map(item => item.count));
  return <section className={styles.card}><div className={styles.cardHeader}><div><h3 className={styles.cardTitle}>{icon}{title}</h3><p className={styles.caption}>{detail}</p></div></div>{items.length === 0 ? <div className={styles.emptySmall}>{zh ? "此时段暂无记录" : "No records in this period"}</div> : <ol className={styles.ranking}>{items.map(item => <li className={styles.rankRow} key={item.label}><div className={styles.rankLabel}><span className={styles.rankName}>{item.label}</span><span className={styles.rankValue}>{item.count.toLocaleString()}</span></div><div className={styles.barTrack} aria-hidden="true"><div className={styles.barFill} style={{ width: `${item.count / max * 100}%` }} /></div></li>)}</ol>}</section>;
}

function sourceLabel(source: string, zh: boolean) {
  const labels: Record<string, [string, string]> = { direct: ["直接访问", "Direct"], internal: ["站内导航", "Internal navigation"], google: ["Google", "Google"], baidu: ["百度", "Baidu"], bing: ["Bing", "Bing"], duckduckgo: ["DuckDuckGo", "DuckDuckGo"], social: ["社交平台", "Social"], other: ["其他来源", "Other"] };
  return labels[source]?.[zh ? 0 : 1] ?? (zh ? "其他来源" : "Other");
}
function deviceLabel(device: string, zh: boolean) {
  const labels: Record<string, [string, string]> = { mobile: ["小屏幕", "Small screens"], tablet: ["中屏幕", "Medium screens"], desktop: ["大屏幕", "Large screens"], unknown: ["未知", "Unknown"] };
  return labels[device]?.[zh ? 0 : 1] ?? (zh ? "未知" : "Unknown");
}

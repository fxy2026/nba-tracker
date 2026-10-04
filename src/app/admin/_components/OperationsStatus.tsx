"use client";

import { useEffect, useRef, useState } from "react";
import { Archive, Database, Info, RefreshCw, Server } from "lucide-react";
import { useLocale } from "@/components/LocaleProvider";
import { AdminRequestError, createLatestRequest, readAdminResponse, fetchAdmin, adminErrorText } from "./admin-client";
import styles from "../admin.module.css";

export interface OperationsReport {
  generatedAt: string;
  data: {
    status: "available" | "unavailable";
    source: "bundled-archive";
    recordedSeason: string | null;
    recordedGames: number | null;
    completedRecordedGames: number | null;
    recordedDates: number | null;
    indexedPlayers: number | null;
    playerIndexSeason: string | null;
    playerIndexFetchedAt: string | null;
  };
  environment: { adminConfigured: true; deployment: string };
}
type Status = { kind: "loading" } | { kind: "error"; message: string } | { kind: "ready"; data: OperationsReport };

export default function OperationsStatus({ password, onUnauthorized }: { password: string; onUnauthorized: () => void }) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [state, setState] = useState<Status>({ kind: "loading" });
  const [refresh, setRefresh] = useState(0);
  const gateRef = useRef(createLatestRequest());
  const unauthorizedRef = useRef(onUnauthorized);
  useEffect(() => { unauthorizedRef.current = onUnauthorized; }, [onUnauthorized]);
  useEffect(() => {
    const gate = gateRef.current; const request = gate.begin();
    async function load() {
      setState({ kind: "loading" });
      try {
        const response = await fetchAdmin("/api/admin/stats", { headers: { "x-admin-password": password }, cache: "no-store", signal: request.signal });
        const result = await readAdminResponse<OperationsReport>(response);
        if (!result.data || !["available", "unavailable"].includes(result.data.status) || !result.environment || typeof result.environment.deployment !== "string") throw new Error(zh ? "运行信息响应不完整。" : "The runtime response was incomplete.");
        if (gate.current(request)) setState({ kind: "ready", data: result });
      } catch (error) {
        if (!gate.current(request)) return;
        if (error instanceof AdminRequestError && error.status === 401) { unauthorizedRef.current(); return; }
        setState({ kind: "error", message: adminErrorText(error, zh, zh ? "无法加载运行信息，请重试。" : "Couldn't load runtime information. Please retry.") });
      }
    }
    void load(); return () => gate.cancel();
  }, [password, refresh, zh]);

  return <section className={`${styles.card} ${styles.operations}`} aria-labelledby="admin-operations-title">
    <div className={styles.cardHeader}><div><h2 id="admin-operations-title" className={styles.cardTitle}><Server size={16} />{zh ? "数据与运行信息" : "Data & runtime"}</h2><p className={styles.caption}>{zh ? "已随网站发布的数据覆盖与当前环境" : "Published data coverage and the current environment"}</p></div><button type="button" className={styles.iconButton} disabled={state.kind === "loading"} aria-label={zh ? "刷新运行信息" : "Refresh runtime information"} onClick={() => { gateRef.current.cancel(); setState({ kind: "loading" }); setRefresh(value => value + 1); }}><RefreshCw size={15} className={state.kind === "loading" ? styles.spin : undefined} /></button></div>
    {state.kind === "loading" ? <div className={styles.runtimeGrid} role="status" aria-label={zh ? "正在加载运行信息" : "Loading runtime information"}>{[0, 1, 2, 3].map(key => <div key={key} className={styles.skeleton} style={{ height: 70 }} />)}</div> : state.kind === "error" ? <div className={styles.error} role="alert">{state.message}</div> : <OperationsContent data={state.data} zh={zh} />}
  </section>;
}

export function OperationsContent({ data, zh }: { data: OperationsReport; zh: boolean }) {
  const number = (value: number | null) => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value.toLocaleString(zh ? "zh-CN" : "en-US") : "—";
  const fields = [
    { label: zh ? "已记录比赛" : "Recorded games", value: data.data.recordedGames, hint: data.data.recordedSeason },
    { label: zh ? "已完赛记录" : "Completed game records", value: data.data.completedRecordedGames, hint: data.data.recordedSeason },
    { label: zh ? "比赛日期覆盖" : "Recorded game dates", value: data.data.recordedDates, hint: zh ? "仅限已有记录" : "Published records only" },
    { label: zh ? "内置球员索引条目" : "Bundled player index entries", value: data.data.indexedPlayers, hint: data.data.playerIndexSeason },
  ];
  return <div className={styles.stack}>
    <div className={styles.runtimeGrid}>{fields.map(field => <div key={field.label} className={styles.runtimeMetric}><p className={styles.metricLabel}>{field.label}</p><p className={styles.runtimeValue}>{number(field.value)}</p><p className={styles.metricNote}>{field.hint ?? (zh ? "信息暂不可用" : "Information unavailable")}</p></div>)}</div>
    <div className={styles.runtimeMeta}><span className={styles.badge}><Server size={12} />{zh ? "部署环境" : "Environment"}: {data.environment.deployment}</span><span className={styles.badge}><Archive size={12} />{zh ? "已发布归档" : "Published archive"}</span><span className={`${styles.badge} ${data.data.status === "available" ? styles.readyBadge : ""}`}><Database size={12} />{data.data.status === "available" ? (zh ? "本地数据可读取" : "Local data readable") : (zh ? "部分数据暂不可用" : "Some local data unavailable")}</span></div>
    <div className={styles.note}><Info size={14} /><p>{zh ? "这些数字来自网站内置归档，不表示当前赛季已完整覆盖，不代表球员历史档案或搜索结果的完整范围，也不代表上游接口实时可用。" : "These figures come from the site's bundled archive. They don't imply complete current-season coverage the full historical-player registry or search coverage, or live availability of upstream services."}</p></div>
  </div>;
}

"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import type { AdminArchiveCoverage, CoverageDates } from "@/lib/admin-archive-coverage";
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
  coverage?: AdminArchiveCoverage;
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
    <ArchiveCoverage coverage={data.coverage} zh={zh} />
    <div className={styles.runtimeMeta}><span className={styles.badge}><Server size={12} />{zh ? "部署环境" : "Environment"}: {data.environment.deployment}</span><span className={styles.badge}><Archive size={12} />{zh ? "已发布归档" : "Published archive"}</span><span className={`${styles.badge} ${data.data.status === "available" ? styles.readyBadge : ""}`}><Database size={12} />{data.data.status === "available" ? (zh ? "赛程与索引可读取" : "Schedule & index readable") : (zh ? "部分数据暂不可用" : "Some local data unavailable")}</span></div>
    <div className={styles.note}><Info size={14} /><p>{zh ? "各项数字来自不同范围的内置数据，不能相加作为球员总数。不表示当前赛季、NBA 历史或搜索结果已完整覆盖，也不代表上游接口实时可用。刷新只重新生成报告，不会更新源数据。" : "These bundled datasets have different scopes; player counts cannot be added together. They do not imply complete current-season, NBA history or search coverage, or live availability of upstream services. Refreshing regenerates this report, not its source data."}</p></div>
  </div>;
}


function CoverageCard({ title, available, zh, children }: { title: string; available: boolean; zh: boolean; children: ReactNode }) {
  return <section className={styles.coverageCard}>
    <h3 className={styles.coverageTitle}>{title}</h3>
    {available ? children : <><p className={styles.runtimeValue}>—</p><p className={styles.metricNote}>{zh ? "覆盖元数据暂不可用" : "Coverage metadata unavailable"}</p></>}
  </section>;
}

export function ArchiveCoverage({ coverage, zh }: { coverage?: AdminArchiveCoverage; zh: boolean }) {
  const number = (value: number | undefined) => typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? value.toLocaleString(zh ? "zh-CN" : "en-US") : "—";
  const dates = (value: CoverageDates | undefined) => !value ? "—" : value.first === value.last ? value.first : `${value.first} – ${value.last}`;
  const identities = coverage?.identities?.status === "available" ? coverage.identities.data : null;
  const nba = coverage?.nbaCareers?.status === "available" ? coverage.nbaCareers.data : null;
  const secondary = coverage?.secondaryCareers?.status === "available" ? coverage.secondaryCareers.data : null;
  const shots = coverage?.shots?.status === "available" ? coverage.shots.data : null;
  return <div className={styles.coverageGrid} aria-label={zh ? "按来源区分的归档覆盖" : "Archive coverage by source"}>
    <CoverageCard title={zh ? "NBA 官方身份快照" : "Official identity snapshot"} available={!!identities} zh={zh}>
      <p className={styles.coverageValue}>{number(identities?.playerIds)} <span>{zh ? "个球员 ID" : "player IDs"}</span></p>
      <p className={styles.metricNote}>NBA Stats CommonAllPlayers</p>
      <p className={styles.metricNote}>{zh ? "源数据获取日期" : "Source retrieved"}: {dates(identities?.sourceRetrievedOn)}</p>
      <p className={styles.coverageNote}>{zh ? "身份记录，不代表每位球员都有生涯统计。" : "Identity records; career statistics are not available for every ID."}</p>
    </CoverageCard>
    <CoverageCard title={zh ? "NBA.com 已审核生涯" : "NBA.com-reviewed careers"} available={!!nba} zh={zh}>
      <p className={styles.coverageValue}>{number(nba?.players)} <span>{zh ? "位球员" : "players"}</span></p>
      <p className={styles.metricNote}>{number(nba?.regularSeasonRows)} {zh ? "条常规赛赛季记录" : "regular-season rows"}</p>
      <p className={styles.metricNote}>{zh ? "源页面采集日期" : "Source captured"}: {dates(nba?.sourceCapturedOn)}</p>
      <p className={styles.coverageNote}>{zh ? "本地审核的 NBA.com 生涯页面快照。" : "Locally reviewed NBA.com career-page captures."}</p>
    </CoverageCard>
    <CoverageCard title={zh ? "次级来源已审核生涯" : "Secondary-source careers"} available={!!secondary} zh={zh}>
      <p className={styles.coverageValue}>{number(secondary?.players)} <span>{zh ? "位球员" : "players"}</span></p>
      <p className={styles.metricNote}>{number(secondary?.seasonTypeRows)} {zh ? "条赛季/类型记录" : "season/type rows"} · {number(secondary?.regularSeasonRows)} {zh ? "常规赛" : "regular"} · {number(secondary?.playoffRows)} {zh ? "季后赛" : "playoff"}</p>
      <p className={styles.metricNote}>{zh ? "源数据获取日期" : "Source retrieved"}: {dates(secondary?.sourceRetrievedOn)}</p>
      <p className={styles.coverageNote}>{zh ? "已审核的次级来源；完整生涯统计未经 NBA 官方核验。" : "Reviewed secondary sources; full career totals are not NBA-verified."}</p>
    </CoverageCard>
    <CoverageCard title={zh ? "第三方投篮归档" : "Third-party shot archive"} available={!!shots} zh={zh}>
      <p className={styles.coverageValue}>{number(shots?.players)} <span>{zh ? "位有投篮记录的球员" : "players with shots"}</span></p>
      <p className={styles.metricNote}>{number(shots?.packs)} {zh ? "个归档包" : "packs"} · {number(shots?.seasons)} {zh ? "个赛季" : "seasons"} · {shots?.firstSeason} – {shots?.lastSeason}</p>
      <p className={styles.metricNote}>{number(shots?.playerSeasonTypeEntries)} {zh ? "条球员/赛季/类型记录" : "player-season/type entries"}</p>
      <p className={styles.metricNote}>{number(shots?.acceptedAttempts)} {zh ? "次已接纳出手" : "accepted attempts"} · {zh ? "隔离记录未计入" : "quarantined rows excluded"}: {number(shots?.quarantinedRows)}</p>
      <p className={styles.metricNote}>{zh ? "元数据本地核验日期" : "Metadata locally verified"}: {dates(shots?.localVerifiedOn)}</p>
      <p className={styles.coverageNote}>{zh ? `原始来源采集日期未记录；归档未经完整官方对账，${number(shots?.packsWithControlMismatches)} 个包存在对照值差异。` : `Original source capture date unrecorded; not fully reconciled with NBA totals. ${number(shots?.packsWithControlMismatches)} packs have control mismatches.`}</p>
    </CoverageCard>
  </div>;
}

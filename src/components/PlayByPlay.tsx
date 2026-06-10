"use client";

import { useState, useMemo, memo } from "react";
import { useLocale } from "@/components/LocaleProvider";

function formatClock(raw: string): string {
  if (!raw) return "";
  const match = raw.match(/PT(\d+)M([\d.]+)S/);
  if (!match) return raw;
  const min = parseInt(match[1]);
  const sec = Math.floor(parseFloat(match[2]));
  return `${min}:${sec.toString().padStart(2, "0")}`;
}

export interface PlayAction {
  actionNumber: number;
  clock: string;
  period: number;
  teamTricode: string;
  actionType: string;
  subType: string;
  description: string;
  personId: number;
  playerNameI: string;
  shotResult?: string;
  scoreHome: string;
  scoreAway: string;
  isFieldGoal?: number;
  // Extras for the localized text feed (optional — absent in older callers)
  descriptor?: string;
  qualifiers?: string[];
  assistPlayerNameInitial?: string;
  shotDistance?: number;
}

// ---- zh event templates -----------------------------------------------------
// CDN descriptions are English-only. Translate the common actionType/subType
// combos via templates; anything unmapped falls back to the raw description.

const SHOT_SUBTYPE_ZH: Record<string, string> = {
  "Jump Shot": "跳投",
  Layup: "上篮",
  DUNK: "扣篮",
  Hook: "勾手",
};

const DESCRIPTOR_TOKEN_ZH: Record<string, string> = {
  driving: "突破",
  pullup: "急停",
  stepback: "后撤步",
  fadeaway: "后仰",
  turnaround: "转身",
  running: "行进间",
  cutting: "空切",
  reverse: "反手",
  tip: "点拨",
  putback: "补篮",
  alleyoop: "空接",
  fingerroll: "挑篮",
  floating: "抛投",
  bank: "打板",
};

// "driving finger roll" → 突破挑篮; null = unknown wording, caller falls back
function descriptorZh(descriptor?: string): string | null {
  if (!descriptor) return "";
  const tokens = descriptor
    .replace("finger roll", "fingerroll")
    .replace("step back", "stepback")
    .replace("alley-oop", "alleyoop")
    .split(" ");
  let out = "";
  for (const tk of tokens) {
    const zh = DESCRIPTOR_TOKEN_ZH[tk];
    if (!zh) return null;
    out += zh;
  }
  return out;
}

const FOUL_DESCRIPTOR_ZH: Record<string, string> = {
  shooting: "投篮犯规",
  "loose ball": "争抢犯规",
  take: "战术犯规",
  "away-from-play": "无球犯规",
  "flagrant-type-1": "一级恶意犯规",
  "flagrant-type-2": "二级恶意犯规",
};

const TURNOVER_ZH: Record<string, string> = {
  "bad pass": "传球失误",
  "lost ball": "丢球失误",
  "out-of-bounds": "失误（球出界）",
  "offensive foul": "进攻犯规失误",
  "shot clock": "24秒违例",
  traveling: "走步违例",
  backcourt: "回场违例",
  "8-second-violation": "8秒违例",
  "double dribble": "两次运球违例",
  palming: "翻腕违例",
  "step out of bounds": "踩线出界失误",
};

const VIOLATION_ZH: Record<string, string> = {
  "defensive goaltending": "干扰球违例",
  "kicked ball": "脚踢球违例",
  "delay-of-game": "拖延比赛违例",
  lane: "三秒区违例",
};

function periodZh(p: number): string {
  return p <= 4 ? `第${p}节` : `第${p - 4}加时`;
}

/** Localized one-line text for a play. en = raw CDN description. */
export function describeAction(a: PlayAction, isZh: boolean): string {
  if (!isZh) return a.description;
  const player = a.playerNameI || "";
  const team = a.teamTricode || "";
  switch (a.actionType) {
    case "2pt":
    case "3pt": {
      const desc = descriptorZh(a.descriptor);
      const sub = SHOT_SUBTYPE_ZH[a.subType];
      if (desc === null || (a.actionType === "2pt" && !sub)) return a.description;
      // tip/putback shots are second-chance by definition — skip the prefix
      const tipOrPutback = desc.includes("点拨") || desc.includes("补篮");
      const prefix = a.qualifiers?.includes("fastbreak")
        ? "快攻"
        : a.qualifiers?.includes("2ndchance") && !tipOrPutback
        ? "二次进攻"
        : "";
      // NBA descriptions floor the distance ("25' 3PT") — match them
      const dist =
        a.shotDistance && a.shotDistance >= 10 ? `${Math.floor(a.shotDistance)}英尺` : "";
      let shot: string;
      if (a.actionType === "3pt") {
        // 3pt is always a jumper — "后撤步三分" reads better than "后撤步三分跳投"
        shot = desc ? `${desc}三分` : "三分跳投";
      } else if (desc.includes("补篮")) {
        // putback already names the finish — "补篮" / "补扣", not "补篮上篮"
        shot = a.subType === "DUNK" ? desc.replace("补篮", "补扣") : desc;
      } else if (desc.includes("抛投") || (desc.includes("挑篮") && a.subType === "Layup")) {
        // 抛投/挑篮 already imply the shot type — drop the redundant 跳投/上篮
        shot = desc;
      } else {
        shot = `${desc}${sub}`;
      }
      const made = a.shotResult === "Made";
      const result = made ? "命中" : /blocked/i.test(a.description) ? "被封盖" : "不中";
      const assist =
        made && a.assistPlayerNameInitial ? `（${a.assistPlayerNameInitial} 助攻）` : "";
      return `${player} ${prefix}${dist}${shot}${result}${assist}`;
    }
    case "freethrow": {
      const m = a.subType?.match(/(\d+) of (\d+)/);
      const result = a.shotResult === "Made" ? "命中" : "不中";
      return m ? `${player} 罚球 ${m[1]}/${m[2]} ${result}` : `${player} 罚球${result}`;
    }
    case "rebound": {
      const kind = a.subType === "offensive" ? "进攻篮板" : "防守篮板";
      return player ? `${player} 抢到${kind}` : `${team} 团队${kind}`;
    }
    case "substitution":
      return a.subType === "in" ? `换人：${player} 上场` : `换人：${player} 下场`;
    case "foul": {
      if (a.subType === "technical") return `${player || team} 技术犯规`;
      if (a.subType === "offensive")
        return `${player} ${a.descriptor === "charge" ? "带球撞人" : "进攻犯规"}`;
      const kind = (a.descriptor && FOUL_DESCRIPTOR_ZH[a.descriptor]) || "个人犯规";
      return `${player || team} ${kind}`;
    }
    case "turnover":
      return `${player || team} ${TURNOVER_ZH[a.subType] || "失误"}`;
    case "steal":
      return `${player} 抢断`;
    case "block":
      return `${player} 封盖`;
    case "timeout":
      return a.subType === "challenge" ? `${team} 教练挑战` : `${team} 请求暂停`;
    case "jumpball":
      return player ? `跳球：${player} 获得球权` : a.description;
    case "violation":
      return `${player || team} ${VIOLATION_ZH[a.subType] || "违例"}`;
    case "period":
      return `${periodZh(a.period)}${a.subType === "start" ? "开始" : "结束"}`;
    case "game":
      return a.subType === "end" ? "比赛结束" : a.description;
    default:
      return a.description;
  }
}

interface Props {
  actions: PlayAction[];
  isLive?: boolean;
}

export default memo(function PlayByPlay({ actions, isLive = false }: Props) {
  const { locale, t } = useLocale();
  const isZh = locale === "zh";

  const periods = useMemo(() => {
    // PBP actions arrive in chronological order, but be defensive: track max period
    // and emit 1..max — covers all observed periods including OT without a Set+sort.
    let max = 0;
    for (const a of actions) if (a.period > max) max = a.period;
    const ps: number[] = [];
    for (let p = 1; p <= max; p++) ps.push(p);
    return ps;
  }, [actions]);

  const latestPeriod = periods[periods.length - 1] || 4;
  // null = follow the latest period (so a live game auto-advances into new
  // quarters across refreshes); a number = the user pinned a specific tab.
  const [pinnedPeriod, setPinnedPeriod] = useState<number | null>(null);
  const selectedPeriod = pinnedPeriod ?? latestPeriod;

  const [view, setView] = useState<"all" | "scoring">("all");

  const filteredActions = useMemo(() => {
    const rows = actions.filter(
      (a) =>
        a.period === selectedPeriod &&
        a.description &&
        (view === "all" || a.shotResult === "Made")
    );
    // Newest-first only while live — Hupu-style "follow from the office" feed;
    // finished games read top-down chronologically.
    return isLive ? rows.reverse() : rows;
  }, [actions, selectedPeriod, view, isLive]);

  const getActionStyle = (action: PlayAction) => {
    if (action.shotResult === "Made") return "border-l-success bg-success/5";
    if (action.shotResult === "Missed") return "border-l-danger/50";
    if (action.actionType === "foul") return "border-l-accent-amber/50";
    if (action.actionType === "turnover") return "border-l-danger/30";
    if (action.actionType === "timeout") return "border-l-text-secondary";
    if (action.actionType === "period" || action.actionType === "game")
      return "border-l-accent/40 bg-bg-secondary/40";
    return "border-l-border";
  };

  const getActionIcon = (action: PlayAction) => {
    if (action.shotResult === "Made") return "🏀";
    if (action.actionType === "foul") return "🚫";
    if (action.actionType === "turnover") return "💫";
    if (action.actionType === "timeout") return "⏱";
    if (action.actionType === "substitution") return "🔄";
    if (action.actionType === "rebound") return "📥";
    return "";
  };

  if (actions.length === 0) return null;

  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-text-primary tracking-tight flex items-center gap-2">
          <span className="w-1 h-4 bg-accent-amber rounded-full" />
          {t.playByPlayComp.title}
          {isLive && (
            <span className="flex items-center gap-1 text-[10px] font-mono uppercase tracking-[0.15em] text-danger">
              <span className="w-1.5 h-1.5 rounded-full bg-danger animate-pulse" />
              {t.playByPlayComp.live}
            </span>
          )}
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="glass-tile flex overflow-hidden p-1">
            {(["all", "scoring"] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all cursor-pointer ${
                  view === v ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                {v === "all" ? t.playByPlayComp.fullFeed : t.playByPlayComp.scoringOnly}
              </button>
            ))}
          </div>
          <div className="glass-tile flex overflow-hidden p-1">
            {periods.map((p) => (
              <button
                key={p}
                onClick={() => setPinnedPeriod(p)}
                aria-pressed={selectedPeriod === p}
                className={`px-3 py-1 text-xs font-medium font-mono rounded-md transition-all cursor-pointer ${
                  selectedPeriod === p ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
                }`}
              >
                {p <= 4 ? `${t.playByPlayComp.quarter}${p}` : `${t.playByPlayComp.overtime}${p - 4}`}
                <span className="text-[8px] opacity-60 ml-0.5 tabular-nums">
                  ({actions.filter((a) => a.period === p && a.description && (view === "all" || a.shotResult === "Made")).length})
                </span>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-h-[500px] overflow-y-auto divide-y divide-border/30">
        {filteredActions.map((action) => (
          <div
            key={action.actionNumber}
            className={`flex items-start gap-3 px-4 py-2.5 border-l-2 ${getActionStyle(action)}`}
          >
            <span className="text-xs text-text-secondary font-mono w-12 shrink-0 pt-0.5">
              {formatClock(action.clock)}
            </span>
            <span className="text-sm shrink-0 w-5">{getActionIcon(action)}</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-text-primary">
                {action.teamTricode && (
                  <span className="text-xs font-medium text-accent mr-1.5">{action.teamTricode}</span>
                )}
                {describeAction(action, isZh)}
              </p>
            </div>
            {action.scoreAway && action.scoreHome && (
              <span
                className={`text-xs font-mono shrink-0 tabular-nums ${
                  action.shotResult === "Made" ? "text-text-primary font-semibold" : "text-text-secondary"
                }`}
              >
                {action.scoreAway}-{action.scoreHome}
              </span>
            )}
          </div>
        ))}
        {filteredActions.length === 0 && (
          <div className="px-4 py-8 text-center text-text-secondary text-sm">
            {t.playByPlayComp.noPlayData}
          </div>
        )}
      </div>
    </div>
  );
});

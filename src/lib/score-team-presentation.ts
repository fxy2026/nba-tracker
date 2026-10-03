import type { CSSProperties } from "react";
import { TEAM_META } from "./teams";

const NAMES_ZH: Record<string, string> = {
  ATL: "老鹰", BOS: "凯尔特人", BKN: "篮网", CHA: "黄蜂", CHI: "公牛", CLE: "骑士",
  DAL: "独行侠", DEN: "掘金", DET: "活塞", GSW: "勇士", HOU: "火箭", IND: "步行者",
  LAC: "快船", LAL: "湖人", MEM: "灰熊", MIA: "热火", MIL: "雄鹿", MIN: "森林狼",
  NOP: "鹈鹕", NYK: "尼克斯", OKC: "雷霆", ORL: "魔术", PHI: "76人", PHX: "太阳",
  POR: "开拓者", SAC: "国王", SAS: "马刺", TOR: "猛龙", UTA: "爵士", WAS: "奇才",
};

export function scoreTeamName(tricode: string, isZh: boolean): string {
  return (isZh ? NAMES_ZH[tricode] : TEAM_META[tricode]?.name) ?? tricode;
}

/** Shared team identities for the score table, legend, lines and selected scores. */
export function scoreTeamStyle(home: string, away: string): CSSProperties {
  const color = (team: string) => team === "SAS" ? "#596B78" : team === "BKN" ? "#525A67" : (TEAM_META[team]?.primaryColor ?? "#64748B");
  const dark = (hex: string) => `#${[1, 3, 5].map(start => Math.round(Number.parseInt(hex.slice(start, start + 2), 16) * 0.72 + 255 * 0.28).toString(16).padStart(2, "0")).join("")}`;
  return {
    "--score-home-base": color(home), "--score-away-base": color(away),
    "--score-home-dark": dark(color(home)), "--score-away-dark": dark(color(away)),
  } as CSSProperties;
}

import type { BoxScore } from "@/lib/api";
import type { PlayAction } from "@/components/PlayByPlay";
import { buildRecap } from "@/lib/recap";

// 自动战报 — template-generated narrative recap for finished games. All copy
// comes from buildRecap (deterministic per gameId), styled like GameHeadlines.
export default function GameRecap({
  boxScore,
  actions,
  isPlayoffs,
  isZh,
}: {
  boxScore: BoxScore;
  actions: PlayAction[];
  isPlayoffs: boolean;
  isZh: boolean;
}) {
  const recap = buildRecap(boxScore, actions, { isPlayoffs });
  if (!recap) return null;
  const r = isZh ? recap.zh : recap.en;

  return (
    <div className="glass-tile p-4 mt-4">
      <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
        <span className="w-1 h-4 bg-accent rounded-full" />
        {isZh ? "自动战报" : "Game Recap"}
        <span className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60 font-normal">
          {isZh ? "数据生成" : "Auto-generated"}
        </span>
      </h3>
      <p className="text-base font-bold text-text-primary leading-snug mb-3">{r.title}</p>
      <div className="space-y-2.5">
        {r.paragraphs.map((para, i) => (
          <p key={i} className="text-sm text-text-secondary leading-relaxed">
            {para}
          </p>
        ))}
      </div>
    </div>
  );
}

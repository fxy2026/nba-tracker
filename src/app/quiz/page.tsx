"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HelpCircle, RefreshCw, Trophy, Crown } from "lucide-react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import { useLocale } from "@/components/LocaleProvider";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";

interface Player {
  personId: number;
  firstName: string;
  lastName: string;
  teamAbbr: string;
  pts: number;
  reb: number;
  ast: number;
  position: string;
}

type Mode = "headshot" | "statline" | "team" | "legend";

// Build a Player-shaped pool from the static all-time-leaders dataset so
// the existing question-building helpers work unchanged on it.
function legendsAsPlayers(): Player[] {
  return ALL_TIME_LEADERS.map((l, i) => {
    const [first, ...rest] = l.name.split(" ");
    return {
      // For retired legends personId=0; pad with index so multi-choice keys stay unique.
      personId: l.personId || -(i + 1),
      firstName: first,
      lastName: rest.join(" "),
      teamAbbr: l.team,
      pts: l.ppg,
      reb: l.rpg,
      ast: l.apg,
      position: l.active ? "Active" : "Retired",
    };
  });
}

const MODES: { key: Mode; label: string; description: string; labelZh: string; descriptionZh: string }[] = [
  { key: "headshot", label: "Guess from headshot", description: "Pick the name from a player's portrait", labelZh: "看头像猜人", descriptionZh: "从头像选出对应球员名字" },
  { key: "statline", label: "Guess from stats", description: "Identify a player by their season averages", labelZh: "看数据猜人", descriptionZh: "通过赛季均数据辨认球员" },
  { key: "team", label: "Guess the team", description: "Which team does this player play for?", labelZh: "猜球队", descriptionZh: "这名球员效力哪支球队？" },
  { key: "legend", label: "Guess the legend", description: "Career averages of NBA history's greats — pick the right legend", labelZh: "猜历史名人", descriptionZh: "通过生涯均数据辨认 NBA 历史巨星" },
];

function sample<T>(arr: T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

interface Question {
  answer: Player;
  choices: Player[] | string[];
}

function buildQuestion(pool: Player[], mode: Mode): Question {
  // Legend mode uses the static GOAT pool exclusively — no PPG floor since
  // even low-scoring legends (Bill Russell, Dennis Rodman) are quiz-worthy.
  const effectivePool = mode === "legend" ? legendsAsPlayers() : pool;
  const candidates = mode === "legend"
    ? effectivePool
    : effectivePool.filter((p) => p.pts >= 8);
  const picks = sample(candidates, 4);
  const answer = picks[0];
  if (mode === "team") {
    const teams = [...new Set(pool.map((p) => p.teamAbbr).filter(Boolean))];
    const otherTeams = sample(teams.filter((t) => t !== answer.teamAbbr), 3);
    const teamChoices = sample([answer.teamAbbr, ...otherTeams], 4);
    return { answer, choices: teamChoices };
  }
  return { answer, choices: sample(picks, 4) };
}

export default function QuizPage() {
  const { locale } = useLocale();
  const isZh = locale === "zh";
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("headshot");
  const [score, setScore] = useState({ right: 0, wrong: 0 });
  const [picked, setPicked] = useState<string | number | null>(null);
  const [showAnswer, setShowAnswer] = useState(false);
  const [seed, setSeed] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    (async () => {
      try {
        const res = await fetch("/api/player-index", { signal: controller.signal });
        if (res.ok) {
          const json = await res.json();
          if (!controller.signal.aborted) setPlayers(json.data || []);
        }
      } catch { /* ignore */ }
      if (!controller.signal.aborted) setLoading(false);
    })();
    return () => controller.abort();
  }, []);

  const q = useMemo(() => {
    if (players.length === 0) return null;
    void seed; // force regen
    return buildQuestion(players, mode);
  }, [players, mode, seed]);

  const handlePick = (val: string | number) => {
    if (showAnswer) return;
    setPicked(val);
    setShowAnswer(true);
    const correct = mode === "team"
      ? val === q?.answer.teamAbbr
      : val === q?.answer.personId;
    setScore((s) => correct ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 });
  };

  const next = () => {
    setPicked(null);
    setShowAnswer(false);
    setSeed((s) => s + 1);
  };

  const reset = () => {
    setScore({ right: 0, wrong: 0 });
    next();
  };

  const total = score.right + score.wrong;
  const accuracy = total > 0 ? (score.right / total) * 100 : 0;

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "游戏" : "Game"}
        icon={HelpCircle}
        title={isZh ? "NBA 测验" : "NBA Quiz"}
        subtitle={
          isZh
            ? "测试你的 NBA 知识 — 看头像、看数据、或猜球队，三种模式自动计分。"
            : "Guess the player from a headshot, stat line, or team · how well do you know the league?"
        }
      />

      <div className="glass-tile flex flex-wrap overflow-hidden p-1 mb-6 w-fit">
        {MODES.map((m) => (
          <button
            key={m.key}
            onClick={() => { setMode(m.key); reset(); }}
            className={`px-3 py-2 text-xs font-medium rounded-md transition-all cursor-pointer ${
              mode === m.key ? "bg-accent text-white shadow-md" : "text-text-secondary hover:text-text-primary hover:bg-bg-hover"
            }`}
          >
            {isZh ? m.labelZh : m.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="glass-tile p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? "答对" : "Right"}</p>
          <p className="text-2xl font-light font-mono tabular-nums text-success">{score.right}</p>
        </div>
        <div className="glass-tile p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? "答错" : "Wrong"}</p>
          <p className="text-2xl font-light font-mono tabular-nums text-danger">{score.wrong}</p>
        </div>
        <div className="glass-tile p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? "正确率" : "Accuracy"}</p>
          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{accuracy.toFixed(0)}%</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-tile h-64 skeleton-shimmer" />
      ) : !q ? (
        <div className="glass-tile p-6 text-center">
          <p className="text-sm text-text-secondary">{isZh ? "无法加载测验所需的球员数据。" : "Could not load player data for quiz."}</p>
        </div>
      ) : (
        <div className="glass-tile p-6">
          {/* Question */}
          <div className="mb-6 text-center">
            {mode === "headshot" && (
              <div className="flex flex-col items-center gap-3">
                <PlayerHeadshot personId={q.answer.personId} name={`${q.answer.firstName} ${q.answer.lastName}`} size={140} />
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">{isZh ? "这位是谁？" : "Who is this player?"}</p>
              </div>
            )}
            {mode === "statline" && (
              <div>
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-3">{isZh ? "赛季均数据" : "Season Averages"}</p>
                <div className="flex items-center justify-center gap-6 font-mono">
                  <div><p className="text-3xl tabular-nums text-accent-amber">{q.answer.pts.toFixed(1)}</p><p className="text-[10px] uppercase text-text-secondary">PPG</p></div>
                  <div><p className="text-3xl tabular-nums text-text-primary">{q.answer.reb.toFixed(1)}</p><p className="text-[10px] uppercase text-text-secondary">RPG</p></div>
                  <div><p className="text-3xl tabular-nums text-text-primary">{q.answer.ast.toFixed(1)}</p><p className="text-[10px] uppercase text-text-secondary">APG</p></div>
                  <div><p className="text-xl tabular-nums text-accent">{q.answer.position}</p><p className="text-[10px] uppercase text-text-secondary">{isZh ? "位置" : "Pos"}</p></div>
                </div>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mt-3">{isZh ? "这是谁的数据？" : "Whose averages are these?"}</p>
              </div>
            )}
            {mode === "team" && (
              <div className="flex flex-col items-center gap-3">
                <PlayerHeadshot personId={q.answer.personId} name={`${q.answer.firstName} ${q.answer.lastName}`} size={100} />
                <p className="text-lg font-semibold tracking-tight">{q.answer.firstName} {q.answer.lastName}</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">{isZh ? `${q.answer.firstName} 效力哪支球队？` : `Which team does ${q.answer.firstName} play for?`}</p>
              </div>
            )}
            {mode === "legend" && (
              <div>
                <div className="flex items-center justify-center gap-2 mb-3">
                  <Crown size={14} className="text-accent-amber" aria-hidden="true" />
                  <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-accent-amber">{isZh ? "生涯场均" : "Career Averages"}</p>
                </div>
                <div className="flex items-center justify-center gap-6 font-mono">
                  <div><p className="text-3xl tabular-nums text-accent-amber">{q.answer.pts.toFixed(1)}</p><p className="text-[10px] uppercase text-text-secondary">PPG</p></div>
                  <div><p className="text-3xl tabular-nums text-text-primary">{q.answer.reb.toFixed(1)}</p><p className="text-[10px] uppercase text-text-secondary">RPG</p></div>
                  <div><p className="text-3xl tabular-nums text-text-primary">{q.answer.ast.toFixed(1)}</p><p className="text-[10px] uppercase text-text-secondary">APG</p></div>
                  <div><p className="text-xs tabular-nums text-accent uppercase">{q.answer.position}</p><p className="text-[10px] uppercase text-text-secondary">{isZh ? "状态" : "Status"}</p></div>
                </div>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mt-3">{isZh ? "这是哪位历史名人？" : "Which all-time legend is this?"}</p>
              </div>
            )}
          </div>

          {/* Choices */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {mode === "team" ? (
              (q.choices as string[]).map((c) => {
                const isCorrect = c === q.answer.teamAbbr;
                const isPicked = picked === c;
                return (
                  <button
                    key={c}
                    onClick={() => handlePick(c)}
                    disabled={showAnswer}
                    className={`glass-tile p-4 text-center font-mono text-base font-bold transition-all cursor-pointer ${
                      showAnswer
                        ? isCorrect
                          ? "bg-success/20 ring-2 ring-success text-success"
                          : isPicked
                            ? "bg-danger/15 ring-2 ring-danger text-danger"
                            : "opacity-50"
                        : "hover:bg-bg-hover hover:scale-[1.02]"
                    }`}
                  >
                    {c}
                  </button>
                );
              })
            ) : (
              (q.choices as Player[]).map((c) => {
                const isCorrect = c.personId === q.answer.personId;
                const isPicked = picked === c.personId;
                return (
                  <button
                    key={c.personId}
                    onClick={() => handlePick(c.personId)}
                    disabled={showAnswer}
                    className={`glass-tile p-4 text-left transition-all cursor-pointer ${
                      showAnswer
                        ? isCorrect
                          ? "bg-success/20 ring-2 ring-success"
                          : isPicked
                            ? "bg-danger/15 ring-2 ring-danger"
                            : "opacity-50"
                        : "hover:bg-bg-hover hover:scale-[1.01]"
                    }`}
                  >
                    <p className="font-semibold text-text-primary">{c.firstName} {c.lastName}</p>
                    <p className="text-[10px] font-mono uppercase tracking-[0.15em] text-text-secondary mt-0.5">
                      {c.teamAbbr || "—"} · {c.position}
                    </p>
                  </button>
                );
              })
            )}
          </div>

          {showAnswer && (
            <div className="mt-5 flex items-center justify-between gap-2">
              {q.answer.personId > 0 ? (
                <Link
                  href={`/player/${q.answer.personId}`}
                  className="text-xs font-mono uppercase tracking-[0.15em] text-accent hover:underline"
                >
                  {isZh ? `查看 ${q.answer.firstName} ${q.answer.lastName} 的页面 →` : `View ${q.answer.firstName} ${q.answer.lastName} profile →`}
                </Link>
              ) : (
                // Retired legend — no profile page; show answer instead
                <p className="text-xs font-mono uppercase tracking-[0.15em] text-accent-amber">
                  {isZh ? `答案：${q.answer.firstName} ${q.answer.lastName}` : `Answer: ${q.answer.firstName} ${q.answer.lastName}`}
                </p>
              )}
              <button
                onClick={next}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors cursor-pointer shrink-0"
              >
                <RefreshCw size={14} />
                {isZh ? "下一题" : "Next question"}
              </button>
            </div>
          )}
        </div>
      )}

      {total >= 10 && accuracy >= 70 && (
        <div className="glass-tile p-4 mt-4 bg-accent-amber/[0.05] flex items-center gap-3">
          <Trophy size={20} className="text-accent-amber shrink-0" />
          <p className="text-xs text-text-secondary">
            {isZh ? (
              <>
                <span className="font-bold text-text-primary">眼力好。</span>{total} 题正确率 <span className="font-mono tabular-nums text-accent-amber">{accuracy.toFixed(0)}%</span> — 远超普通球迷水平。
              </>
            ) : (
              <>
                <span className="font-bold text-text-primary">Sharp eye.</span> You&apos;re at <span className="font-mono tabular-nums text-accent-amber">{accuracy.toFixed(0)}%</span> over {total} questions — well above casual fan territory.
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}

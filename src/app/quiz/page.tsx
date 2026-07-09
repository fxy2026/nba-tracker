"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HelpCircle, RefreshCw, Trophy, Crown, Book, Activity, TrendingUp } from "lucide-react";
import PlayerHeadshot from "@/components/PlayerHeadshot";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { useLocale } from "@/components/LocaleProvider";
import { ALL_TIME_LEADERS } from "@/lib/allTimeLeaders";
import { readQuizStats, recordAnswer, markDailyPlayed, EMPTY_QUIZ_STATS, type QuizStats } from "@/lib/quizStats";
import { hashString } from "@/lib/recap";
import { formatDate } from "@/lib/api";

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

type Mode = "headshot" | "statline" | "team" | "legend" | "daily";

// The daily challenge reuses one of the four base question shapes, chosen
// deterministically from the date so its rendering + scoring paths are shared.
const BASE_MODES: Exclude<Mode, "daily">[] = ["headshot", "statline", "team", "legend"];

// Deterministic PRNG (mulberry32): same seed → same sequence, so a date-seeded
// daily challenge yields the identical question for every visitor that day.
// Pure integer math — no Math.random — so it's safe to call during render.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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
  { key: "daily", label: "Daily challenge", description: "One seeded question a day — everyone gets the same one", labelZh: "每日挑战", descriptionZh: "每天一道题，全站同题，答过即锁" },
];

// `rng` defaults to Math.random for the normal (endless) modes; the daily
// challenge passes a date-seeded mulberry32 so the same question is dealt to
// everyone on a given day.
function sample<T>(arr: T[], n: number, rng: () => number = Math.random): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(rng() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

interface Question {
  answer: Player;
  choices: Player[] | string[];
}

function buildQuestion(pool: Player[], mode: Exclude<Mode, "daily">, rng: () => number = Math.random): Question {
  // Legend mode uses the static GOAT pool exclusively — no PPG floor since
  // even low-scoring legends (Bill Russell, Dennis Rodman) are quiz-worthy.
  const effectivePool = mode === "legend" ? legendsAsPlayers() : pool;
  const candidates = mode === "legend"
    ? effectivePool
    : effectivePool.filter((p) => p.pts >= 8);
  const picks = sample(candidates, 4, rng);
  const answer = picks[0];
  if (mode === "team") {
    const teams = [...new Set(pool.map((p) => p.teamAbbr).filter(Boolean))];
    const otherTeams = sample(teams.filter((t) => t !== answer.teamAbbr), 3, rng);
    const teamChoices = sample([answer.teamAbbr, ...otherTeams], 4, rng);
    return { answer, choices: teamChoices };
  }
  return { answer, choices: sample(picks, 4, rng) };
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

  // Post-hydration gate: lifetime stats live in localStorage, unknowable during
  // SSR. Mirrors the FollowStrip / DateNav idiom — flip a flag after mount, then
  // read storage in an effect keyed off it, never in a useState initializer
  // (which would break SSR and trip the React purity rule).
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- one-shot post-hydration flag; persisted stats are localStorage-only
  useEffect(() => setMounted(true), []);

  const [stats, setStats] = useState<QuizStats>(EMPTY_QUIZ_STATS);
  // Today's ET date, resolved post-mount. `new Date()` is impure so it must not
  // run in render or a useState initializer — the mounted effect reads it once.
  const [todayStr, setTodayStr] = useState("");

  useEffect(() => {
    if (!mounted) return;
    /* eslint-disable react-hooks/set-state-in-effect -- post-mount localStorage + clock reads, intentionally deferred from first paint */
    setStats(readQuizStats());
    setTodayStr(formatDate(new Date()));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [mounted]);

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

  // For the daily challenge, derive a stable seed + concrete question shape from
  // today's date. hashString is pure, so this is render-safe once todayStr is set.
  const daySeed = todayStr ? hashString(todayStr) : 0;
  const effectiveMode: Exclude<Mode, "daily"> =
    mode === "daily" ? BASE_MODES[daySeed % BASE_MODES.length] : mode;
  // Already answered today's daily → lock it (can't be farmed for streak).
  const dailyLocked = mode === "daily" && !!todayStr && stats.playedDailyOn === todayStr;

  const q = useMemo(() => {
    if (players.length === 0) return null;
    if (mode === "daily") {
      // Wait for the post-mount date so the daily is deterministic, never a
      // Math.random flash.
      if (!todayStr) return null;
      return buildQuestion(players, effectiveMode, mulberry32(daySeed));
    }
    void seed; // force regen
    return buildQuestion(players, effectiveMode);
  }, [players, mode, effectiveMode, seed, todayStr, daySeed]);

  const handlePick = (val: string | number) => {
    if (showAnswer) return;
    setPicked(val);
    setShowAnswer(true);
    const correct = effectiveMode === "team"
      ? val === q?.answer.teamAbbr
      : val === q?.answer.personId;
    setScore((s) => correct ? { ...s, right: s.right + 1 } : { ...s, wrong: s.wrong + 1 });
    // Persist lifetime totals + streak (survives reloads / mode switches).
    const next = recordAnswer(correct, todayStr);
    // Lock the daily for the rest of the ET day so it can't be replayed.
    setStats(mode === "daily" && todayStr ? markDailyPlayed(todayStr) : next);
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
      <Breadcrumbs items={[{ label: isZh ? "测验" : "Quiz" }]} />
      <PageHeader
        eyebrow={isZh ? "游戏" : "Game"}
        icon={HelpCircle}
        title={isZh ? "NBA 测验" : "NBA Quiz"}
        subtitle={
          isZh
            ? "测试你的 NBA 知识 — 看头像、看数据、猜球队、认名人，还有每日挑战。"
            : "Headshots, stat lines, teams, legends — plus a daily challenge. How well do you know the league?"
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

      <div className="grid grid-cols-3 gap-2 mb-2">
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

      {/* Lifetime stats — persisted across reloads/mode switches. The "本场" row
          above is this session; this row is your all-time record + hot streak. */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="glass-tile p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? "生涯答对" : "Lifetime"}</p>
          <p className="text-2xl font-light font-mono tabular-nums text-text-primary">{stats.totalRight}</p>
        </div>
        <div className="glass-tile p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? "当前连胜" : "Streak"}</p>
          <p className="text-2xl font-light font-mono tabular-nums text-accent">{stats.curStreak}</p>
        </div>
        <div className="glass-tile p-3 text-center">
          <p className="text-[9px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">{isZh ? "最佳连胜" : "Best"}</p>
          <p className="text-2xl font-light font-mono tabular-nums text-accent-amber">{stats.bestStreak}</p>
        </div>
      </div>

      {loading ? (
        <div className="glass-tile h-64 skeleton-shimmer" />
      ) : dailyLocked && !showAnswer ? (
        <div className="glass-tile p-8 text-center">
          <div className="flex flex-col items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-accent-amber/10 flex items-center justify-center">
              <Trophy size={22} className="text-accent-amber" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-text-primary">
              {isZh ? "今天的每日挑战已完成" : "Today's daily challenge is done"}
            </p>
            <p className="text-sm text-text-secondary max-w-sm">
              {isZh
                ? "每天只有一道每日挑战，明天再来解锁新的一题。"
                : "There's just one daily challenge per day — come back tomorrow for a fresh one."}
            </p>
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary/60">
              {isZh ? `最佳连胜 ${stats.bestStreak}` : `Best streak ${stats.bestStreak}`}
            </p>
          </div>
        </div>
      ) : mode === "daily" && !todayStr ? (
        // Daily question is deterministic from today's date — wait for the
        // post-mount clock read rather than flash a Math.random question.
        <div className="glass-tile h-64 skeleton-shimmer" />
      ) : !q ? (
        <div className="glass-tile p-6 text-center">
          <p className="text-sm text-text-secondary">{isZh ? "无法加载测验所需的球员数据。" : "Could not load player data for quiz."}</p>
        </div>
      ) : (
        <div className="glass-tile p-6">
          {mode === "daily" && (
            <div className="mb-4 flex items-center justify-center gap-1.5">
              <Crown size={12} className="text-accent-amber" aria-hidden="true" />
              <span className="text-[9px] font-mono uppercase tracking-[0.3em] text-accent-amber">
                {isZh ? "每日挑战 · 全站同题" : "Daily challenge · same for everyone"}
              </span>
            </div>
          )}
          {/* Question */}
          <div className="mb-6 text-center">
            {effectiveMode === "headshot" && (
              <div className="flex flex-col items-center gap-3">
                <PlayerHeadshot personId={q.answer.personId} name={`${q.answer.firstName} ${q.answer.lastName}`} size={140} />
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">{isZh ? "这位是谁？" : "Who is this player?"}</p>
              </div>
            )}
            {effectiveMode === "statline" && (
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
            {effectiveMode === "team" && (
              <div className="flex flex-col items-center gap-3">
                <PlayerHeadshot personId={q.answer.personId} name={`${q.answer.firstName} ${q.answer.lastName}`} size={100} />
                <p className="text-lg font-semibold tracking-tight">{q.answer.firstName} {q.answer.lastName}</p>
                <p className="text-[10px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">{isZh ? `${q.answer.firstName} 效力哪支球队？` : `Which team does ${q.answer.firstName} play for?`}</p>
              </div>
            )}
            {effectiveMode === "legend" && (
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
            {effectiveMode === "team" ? (
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
              {mode === "daily" ? (
                <span className="flex items-center gap-2 text-xs font-mono uppercase tracking-[0.15em] text-accent-amber shrink-0">
                  <Trophy size={14} aria-hidden="true" />
                  {isZh ? "明天再来 →" : "Back tomorrow →"}
                </span>
              ) : (
                <button
                  onClick={next}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent hover:bg-accent/90 text-white text-sm font-medium transition-colors cursor-pointer shrink-0"
                >
                  <RefreshCw size={14} />
                  {isZh ? "下一题" : "Next question"}
                </button>
              )}
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

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/glossary", label: isZh ? "NBA 术语" : "NBA glossary", icon: Book },
          { href: "/all-time-leaders", label: isZh ? "历史排行" : "All-time leaders", icon: Crown },
          { href: "/rookie-watch", label: isZh ? "新秀关注" : "Rookie watch", icon: Activity },
          { href: "/milestones", label: isZh ? "生涯里程碑" : "Milestones", icon: TrendingUp },
          { href: "/best-games", label: isZh ? "最佳比赛" : "Best games", icon: Trophy },
        ]}
      />
    </div>
  );
}

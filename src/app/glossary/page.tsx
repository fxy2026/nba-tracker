import type { Metadata } from "next";
import { Book, type LucideIcon, BarChart3, Shield, Zap, Trophy, Calendar } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Glossary",
  description: "NBA terminology, stat definitions, and concepts explained — from PPG to PER, B2B to BORD.",
};

interface Term {
  term: string;
  abbr?: string;
  definition: string;
  example?: string;
}

interface Section {
  title: string;
  eyebrow: string;
  icon: LucideIcon;
  color: string;
  terms: Term[];
}

const SECTIONS: Section[] = [
  {
    title: "Basic Stats",
    eyebrow: "Box Score 101",
    icon: BarChart3,
    color: "#3B82F6",
    terms: [
      { term: "Points Per Game", abbr: "PPG", definition: "Average points scored by a player or team per game." },
      { term: "Rebounds Per Game", abbr: "RPG", definition: "Average rebounds — both offensive (after own team's missed shot) and defensive — per game." },
      { term: "Assists Per Game", abbr: "APG", definition: "Average passes per game that directly lead to a teammate's made basket." },
      { term: "Steals Per Game", abbr: "SPG", definition: "Average possessions taken from an opponent by deflection or live-ball strip." },
      { term: "Blocks Per Game", abbr: "BPG", definition: "Average shot attempts deflected by a defender before reaching the rim." },
      { term: "Turnovers Per Game", abbr: "TOPG", definition: "Average possessions lost by a team due to a bad pass, offensive foul, traveling, etc." },
      { term: "Minutes Played", abbr: "MIN", definition: "Total game time on the court. 48 min per regulation game, +5 min per overtime." },
      { term: "Plus-Minus", abbr: "+/-", definition: "Point differential while a player is on the court — measures team-level impact." },
    ],
  },
  {
    title: "Shooting & Efficiency",
    eyebrow: "Shot quality",
    icon: Zap,
    color: "#F59E0B",
    terms: [
      { term: "Field Goal Percentage", abbr: "FG%", definition: "Made shots divided by attempted shots, all locations. Top scorers usually sit at ≥50% (paint) or ≥40% (wings)." },
      { term: "Three-Point Percentage", abbr: "3P%", definition: "Made threes ÷ attempted threes. League average is around 36%. Elite shooters live above 40%." },
      { term: "Free Throw Percentage", abbr: "FT%", definition: "Made free throws ÷ attempted free throws. Elite shooters are above 85%." },
      { term: "Effective FG%", abbr: "eFG%", definition: "FG% adjusted to credit threes 1.5×. A 40% 3P shooter has eFG% of 60% on threes alone." },
      { term: "True Shooting %", abbr: "TS%", definition: "Scoring efficiency accounting for field goals, threes, and free throws. League average ~57%." },
      { term: "Usage Rate", abbr: "USG%", definition: "Percentage of team possessions a player ends (shot, turnover, FT trip) while on the court." },
      { term: "Offensive Rating", abbr: "ORTG", definition: "Points produced per 100 possessions while a player or team is on the court." },
      { term: "Defensive Rating", abbr: "DRTG", definition: "Points allowed per 100 possessions while a player or team is on the court." },
      { term: "Net Rating", abbr: "NETRTG", definition: "ORTG − DRTG. Positive means the team outscored opponents per 100 possessions." },
    ],
  },
  {
    title: "Advanced",
    eyebrow: "Single-number metrics",
    icon: BarChart3,
    color: "#A855F7",
    terms: [
      { term: "Player Efficiency Rating", abbr: "PER", definition: "Hollinger's per-minute box-score composite. League average is fixed at 15. MVPs typically top 28." },
      { term: "Box Plus-Minus", abbr: "BPM", definition: "Estimate of points contributed per 100 possessions above league average, derived from box-score stats." },
      { term: "Value Over Replacement Player", abbr: "VORP", definition: "Cumulative season impact above a freely-available replacement-level player." },
      { term: "Win Shares", abbr: "WS", definition: "Number of wins a player is estimated to have produced through offense and defense." },
      { term: "Pace", definition: "Possessions per 48 minutes. Faster pace = more shots = inflated counting stats." },
      { term: "Assist-to-Turnover Ratio", abbr: "AST/TO", definition: "Passes that lead to baskets divided by possessions lost. Above 2.0 is solid for guards." },
    ],
  },
  {
    title: "Game & Schedule",
    eyebrow: "Around the calendar",
    icon: Calendar,
    color: "#22C55E",
    terms: [
      { term: "Back-to-Back", abbr: "B2B", definition: "Two games on consecutive calendar days. Win rate on night 2 of B2Bs is historically below average." },
      { term: "Overtime", abbr: "OT", definition: "Five-minute extra period when regulation ends tied. Multiple OTs are possible (2OT, 3OT)." },
      { term: "DNP", definition: "Did Not Play — a player on the roster who didn't see the floor (coach's decision, injury, rest)." },
      { term: "Garbage Time", definition: "Final minutes of a blowout when bench players are in and the result is decided. Stats inflate here." },
      { term: "Tip-Off", definition: "The opening jump ball that starts each game." },
      { term: "Buzzer Beater", definition: "A shot taken before time expires that decides the period or game." },
    ],
  },
  {
    title: "Postseason",
    eyebrow: "Playoffs & beyond",
    icon: Trophy,
    color: "#FFD700",
    terms: [
      { term: "Play-In Tournament", definition: "Mini-tournament for seeds 7-10 of each conference to claim the final two playoff spots." },
      { term: "Conference Finals", abbr: "ECF/WCF", definition: "Best-of-7 series that decides the East and West representatives to the NBA Finals." },
      { term: "Sweep", definition: "Winning a playoff series 4-0 without losing a single game." },
      { term: "Gentleman's Sweep", definition: "Winning a series 4-1 — losing only one game, often when the trailing team's home court drops." },
      { term: "MVP", definition: "Most Valuable Player — regular season's top player as voted by media. Separate Finals MVP exists." },
      { term: "Clutch", definition: "Last 5 minutes of a game with a score margin of 5 or fewer points." },
    ],
  },
  {
    title: "Defense",
    eyebrow: "On the other end",
    icon: Shield,
    color: "#DF1B41",
    terms: [
      { term: "Help Defense", definition: "Rotating off your assignment to contest a teammate's beaten matchup." },
      { term: "Rim Protector", definition: "A big who deters and contests shots at the basket — typically high BPG and low opponent FG% at the rim." },
      { term: "Switch", definition: "Defenders trade assignments during an action like a pick-and-roll instead of fighting over the screen." },
      { term: "Zone Defense", definition: "Each defender guards an area rather than a specific opponent. Limited use in NBA due to rules." },
      { term: "Hedge", definition: "Big briefly comes out to slow the ball-handler in a pick-and-roll before recovering." },
      { term: "Drop Coverage", definition: "Big stays back near the paint in a pick-and-roll, conceding the mid-range to protect the rim." },
    ],
  },
];

export default function GlossaryPage() {
  const totalTerms = SECTIONS.reduce((s, sec) => s + sec.terms.length, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Learn"
        icon={Book}
        title="NBA Glossary"
        subtitle={`${totalTerms} terms and concepts · from box-score basics to advanced metrics and tactical jargon`}
      />

      <div className="space-y-6">
        {SECTIONS.map((sec) => {
          const Icon = sec.icon;
          return (
            <section key={sec.title} className="glass-tile p-5 relative overflow-hidden">
              <div className="absolute inset-y-0 left-0 w-1 opacity-70" style={{ background: sec.color }} />
              <div className="relative">
                <div className="mb-4 flex items-center gap-3">
                  <Icon size={18} style={{ color: sec.color }} />
                  <div>
                    <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {sec.eyebrow}</p>
                    <h2 className="text-xl font-semibold tracking-tight" style={{ color: sec.color }}>{sec.title}</h2>
                  </div>
                </div>
                <dl className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {sec.terms.map((t) => (
                    <div key={t.term} className="glass-tile p-3">
                      <dt className="text-sm font-bold text-text-primary flex items-baseline gap-2 mb-1">
                        {t.term}
                        {t.abbr && (
                          <span className="text-[10px] font-mono uppercase tracking-[0.15em] text-accent">/ {t.abbr}</span>
                        )}
                      </dt>
                      <dd className="text-xs text-text-secondary leading-relaxed">{t.definition}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

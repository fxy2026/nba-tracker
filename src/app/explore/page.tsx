import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Trophy, Calendar, BarChart3, ListOrdered, Flame, Crown, Award, Layers, Zap, TrendingUp, Sparkles, BookOpen, GraduationCap, Globe, School, CalendarDays, Users, GitCompareArrows, Swords, Target, AlertTriangle, ArrowLeftRight, History, Heart, Clock, Activity, Home, Shield, Repeat, HelpCircle, Book, type LucideIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";

export const metadata: Metadata = {
  title: "Explore · Feature Index",
  description: "Browse every page on NBATracker — live scores, rankings, leaderboards, history, and more.",
};

interface FeatureEntry {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  badge?: string;
}

interface FeatureCategory {
  title: string;
  eyebrow: string;
  color: string;
  features: FeatureEntry[];
}

const CATEGORIES: FeatureCategory[] = [
  {
    title: "Live & Scheduled",
    eyebrow: "Tonight",
    color: "#DF1B41",
    features: [
      { href: "/", label: "Today", description: "Live scores, finished games, upcoming tip-offs", icon: Trophy, badge: "LIVE" },
      { href: "/calendar", label: "Calendar", description: "Pick any date to see games and results", icon: Calendar },
      { href: "/schedule", label: "Schedule", description: "Upcoming games across all teams", icon: Clock },
      { href: "/schedule-heatmap", label: "Schedule Heatmap", description: "Game density calendar — busy nights at a glance", icon: Activity },
      { href: "/back-to-back", label: "Back-to-Backs", description: "B2B counts per team and upcoming pairs", icon: Repeat },
      { href: "/game-predictor", label: "Game Predictor", description: "Win probabilities for next 7 days", icon: Zap },
    ],
  },
  {
    title: "Rankings & Standings",
    eyebrow: "League Order",
    color: "#FFD700",
    features: [
      { href: "/standings", label: "Standings", description: "Conference standings with W-L records", icon: ListOrdered },
      { href: "/conference-race", label: "Conference Race", description: "Playoff seeding 1-6, 7-10 play-in, 11-15 lottery", icon: Trophy },
      { href: "/power-rankings", label: "Power Rankings", description: "Composite team strength · 1-30", icon: Crown },
      { href: "/tier-list", label: "Tier List", description: "Teams bucketed S/A/B/C/D", icon: Layers },
      { href: "/streaks", label: "Streaks", description: "Hottest and coldest teams · L10 form dots", icon: Flame },
      { href: "/scoring-output", label: "Scoring Output", description: "Offense, defense, and net point differential", icon: Shield },
      { href: "/home-vs-road", label: "Home vs Road", description: "Best home fortresses and road warriors", icon: Home },
      { href: "/rivalries", label: "Rivalries", description: "Most-played and tightest matchups", icon: Swords },
    ],
  },
  {
    title: "Awards & Leaders",
    eyebrow: "Hardware",
    color: "#A855F7",
    features: [
      { href: "/awards-race", label: "Awards Race", description: "MVP / ROY / DPOY / 6MOY / MIP leaders", icon: Award },
      { href: "/stats", label: "Stat Leaders", description: "Per-game and team statistical leaders", icon: BarChart3 },
      { href: "/all-time-leaders", label: "All-Time Leaders", description: "Career PPG / RPG / APG / tenure", icon: Crown },
      { href: "/milestones", label: "Milestones", description: "Active players chasing career thresholds", icon: TrendingUp },
      { href: "/clutch", label: "Playoff Leaders", description: "Postseason performers", icon: Target },
    ],
  },
  {
    title: "Game Archive",
    eyebrow: "Replay",
    color: "#22C55E",
    features: [
      { href: "/best-games", label: "Best Games", description: "Closest, biggest, OT thrillers", icon: Flame },
      { href: "/records", label: "Season Records", description: "Single-game highs and lows", icon: BookOpen },
      { href: "/this-day", label: "On This Day", description: "Historical games on today's date", icon: CalendarDays },
      { href: "/history", label: "Champions", description: "Past NBA champions and Finals", icon: History },
      { href: "/h2h", label: "Head to Head", description: "Series history between any two teams", icon: Swords },
    ],
  },
  {
    title: "Player Universe",
    eyebrow: "People",
    color: "#3B82F6",
    features: [
      { href: "/search", label: "Player Search", description: "Find any active player by name", icon: Sparkles },
      { href: "/rookie-watch", label: "Rookie Watch", description: "Top first- and second-year players", icon: Sparkles },
      { href: "/draft-classes", label: "Draft Classes", description: "Players grouped by draft year", icon: GraduationCap },
      { href: "/by-position", label: "By Position", icon: Users, description: "Guards / Wings / Forwards / Big Men leaders" },
      { href: "/by-country", label: "By Country", description: "Global representation across the league", icon: Globe },
      { href: "/by-college", label: "By College", description: "NBA pipeline schools and top performers", icon: School },
      { href: "/compare", label: "Compare", description: "Side-by-side stat comparison of two players", icon: GitCompareArrows },
    ],
  },
  {
    title: "News & Personal",
    eyebrow: "Around the league",
    color: "#F59E0B",
    features: [
      { href: "/injuries", label: "Injuries", description: "Latest injury reports across the league", icon: AlertTriangle },
      { href: "/transactions", label: "Transactions", description: "Trades, signings, waivers", icon: ArrowLeftRight },
      { href: "/favorites", label: "Favorites", description: "Your saved teams and players", icon: Heart },
    ],
  },
  {
    title: "Fan Tools",
    eyebrow: "Play & learn",
    color: "#A855F7",
    features: [
      { href: "/quiz", label: "NBA Quiz", description: "Guess players from headshots, stat lines, or teams", icon: HelpCircle },
      { href: "/glossary", label: "Glossary", description: "Stats and terminology explained · PPG to PER", icon: Book },
    ],
  },
];

export default function ExplorePage() {
  const total = CATEGORIES.reduce((s, c) => s + c.features.length, 0);
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow="Index"
        icon={Compass}
        title="Explore"
        subtitle={`Every feature on NBATracker · ${total} pages organized by topic`}
      />

      <div className="space-y-6">
        {CATEGORIES.map((cat) => (
          <section key={cat.title} className="glass-tile p-5 relative overflow-hidden">
            <div className="absolute inset-y-0 left-0 w-1 opacity-70" style={{ background: cat.color }} />
            <div className="relative">
              <div className="mb-4">
                <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60">/ {cat.eyebrow}</p>
                <h2 className="text-xl font-semibold tracking-tight" style={{ color: cat.color }}>{cat.title}</h2>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {cat.features.map((f) => {
                  const Icon = f.icon;
                  return (
                    <Link
                      key={f.href}
                      href={f.href}
                      className="glass-tile p-3 flex items-start gap-3 group cursor-pointer"
                    >
                      <div
                        className="shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: `${cat.color}22`, boxShadow: `inset 0 0 0 1px ${cat.color}44` }}
                      >
                        <Icon size={18} style={{ color: cat.color }} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-text-primary group-hover:text-accent transition-colors flex items-center gap-2">
                          {f.label}
                          {f.badge && (
                            <span className="text-[8px] font-mono px-1.5 py-0.5 rounded bg-danger/15 text-danger uppercase tracking-[0.15em]">
                              {f.badge}
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-text-secondary leading-snug mt-0.5">{f.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

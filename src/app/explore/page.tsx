import type { Metadata } from "next";
import Link from "next/link";
import { Compass, Trophy, Calendar, BarChart3, ListOrdered, Flame, Crown, Award, Layers, Zap, TrendingUp, Sparkles, BookOpen, GraduationCap, Globe, School, CalendarDays, Users, GitCompareArrows, Swords, Target, AlertTriangle, ArrowLeftRight, History, Heart, Clock, Activity, Home, Shield, Repeat, HelpCircle, Book, Map as MapIcon, type LucideIcon } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import { getLocale } from "@/lib/locale";

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

function buildCategories(isZh: boolean): FeatureCategory[] {
  return [
    {
      title: isZh ? "实时与赛程" : "Live & Scheduled",
      eyebrow: isZh ? "今夜" : "Tonight",
      color: "#DF1B41",
      features: [
        { href: "/", label: isZh ? "今日比赛" : "Today", description: isZh ? "实时比分、已结束比赛与即将开打的对决" : "Live scores, finished games, upcoming tip-offs", icon: Trophy, badge: "LIVE" },
        { href: "/calendar", label: isZh ? "日历" : "Calendar", description: isZh ? "选择任意日期查看比赛与结果" : "Pick any date to see games and results", icon: Calendar },
        { href: "/schedule", label: isZh ? "赛程" : "Schedule", description: isZh ? "全部球队的未来比赛" : "Upcoming games across all teams", icon: Clock },
        { href: "/schedule-heatmap", label: isZh ? "赛程热力图" : "Schedule Heatmap", description: isZh ? "比赛密度日历 —— 一眼看清最忙夜" : "Game density calendar — busy nights at a glance", icon: Activity },
        { href: "/back-to-back", label: isZh ? "背靠背" : "Back-to-Backs", description: isZh ? "各队背靠背场次与即将到来的成对赛程" : "B2B counts per team and upcoming pairs", icon: Repeat },
        { href: "/game-predictor", label: isZh ? "胜率预测" : "Game Predictor", description: isZh ? "未来 7 天比赛胜率预测" : "Win probabilities for next 7 days", icon: Zap },
      ],
    },
    {
      title: isZh ? "排名与战绩" : "Rankings & Standings",
      eyebrow: isZh ? "联赛排序" : "League Order",
      color: "#FFD700",
      features: [
        { href: "/standings", label: isZh ? "排名" : "Standings", description: isZh ? "东西部排名与胜负战绩" : "Conference standings with W-L records", icon: ListOrdered },
        { href: "/conference-race", label: isZh ? "分区排位战" : "Conference Race", description: isZh ? "季后赛 1-6 直接晋级、7-10 附加赛、11-15 抽签" : "Playoff seeding 1-6, 7-10 play-in, 11-15 lottery", icon: Trophy },
        { href: "/divisions", label: isZh ? "分区" : "Divisions", description: isZh ? "东西部各三个分区的小排名" : "Six division mini-standings within each conference", icon: MapIcon },
        { href: "/power-rankings", label: isZh ? "实力榜" : "Power Rankings", description: isZh ? "综合球队战力 · 1-30 名" : "Composite team strength · 1-30", icon: Crown },
        { href: "/tier-list", label: isZh ? "分级榜" : "Tier List", description: isZh ? "球队按 S/A/B/C/D 等级分类" : "Teams bucketed S/A/B/C/D", icon: Layers },
        { href: "/streaks", label: isZh ? "连胜连败" : "Streaks", description: isZh ? "最火热与最低迷球队 · 近 10 场战绩点阵" : "Hottest and coldest teams · L10 form dots", icon: Flame },
        { href: "/momentum", label: isZh ? "势头" : "Momentum", description: isZh ? "上升与下滑球队 · 近 5 场对比前 10 场" : "Teams trending up or down · L5 vs prior 10", icon: TrendingUp },
        { href: "/clutch-teams", label: isZh ? "关键球" : "Clutch Teams", description: isZh ? "焦灼比赛与加时赛战绩" : "Records in close games and overtime", icon: Target },
        { href: "/scoring-output", label: isZh ? "得失分" : "Scoring Output", description: isZh ? "进攻、防守与净得分差" : "Offense, defense, and net point differential", icon: Shield },
        { href: "/home-vs-road", label: isZh ? "主场与客场" : "Home vs Road", description: isZh ? "最强主场堡垒与客场杀手" : "Best home fortresses and road warriors", icon: Home },
        { href: "/rivalries", label: isZh ? "宿敌对阵" : "Rivalries", description: isZh ? "交锋最多、最胶着的对阵" : "Most-played and tightest matchups", icon: Swords },
      ],
    },
    {
      title: isZh ? "奖项与排行" : "Awards & Leaders",
      eyebrow: isZh ? "硬奖" : "Hardware",
      color: "#A855F7",
      features: [
        { href: "/awards-race", label: isZh ? "奖项竞争" : "Awards Race", description: isZh ? "MVP / 最佳新秀 / DPOY / 最佳第六人 / 进步最快球员" : "MVP / ROY / DPOY / 6MOY / MIP leaders", icon: Award },
        { href: "/stats", label: isZh ? "数据领袖" : "Stat Leaders", description: isZh ? "场均与球队数据领袖" : "Per-game and team statistical leaders", icon: BarChart3 },
        { href: "/all-time-leaders", label: isZh ? "历史榜单" : "All-Time Leaders", description: isZh ? "生涯场均得分 / 篮板 / 助攻 / 出场年限" : "Career PPG / RPG / APG / tenure", icon: Crown },
        { href: "/milestones", label: isZh ? "里程碑" : "Milestones", description: isZh ? "现役球员冲击生涯门槛" : "Active players chasing career thresholds", icon: TrendingUp },
        { href: "/clutch", label: isZh ? "季后赛领袖" : "Playoff Leaders", description: isZh ? "季后赛表现最佳球员" : "Postseason performers", icon: Target },
      ],
    },
    {
      title: isZh ? "比赛档案" : "Game Archive",
      eyebrow: isZh ? "回放" : "Replay",
      color: "#22C55E",
      features: [
        { href: "/best-games", label: isZh ? "经典之战" : "Best Games", description: isZh ? "最焦灼、最大胜差、加时大战" : "Closest, biggest, OT thrillers", icon: Flame },
        { href: "/records", label: isZh ? "赛季纪录" : "Season Records", description: isZh ? "单场最高与最低纪录" : "Single-game highs and lows", icon: BookOpen },
        { href: "/this-day", label: isZh ? "历史上的今天" : "On This Day", description: isZh ? "今天日期上的历史比赛" : "Historical games on today's date", icon: CalendarDays },
        { href: "/history", label: isZh ? "总冠军" : "Champions", description: isZh ? "历届 NBA 总冠军与总决赛" : "Past NBA champions and Finals", icon: History },
        { href: "/h2h", label: isZh ? "历史交锋" : "Head to Head", description: isZh ? "任意两队的对战历史" : "Series history between any two teams", icon: Swords },
      ],
    },
    {
      title: isZh ? "球员宇宙" : "Player Universe",
      eyebrow: isZh ? "人物" : "People",
      color: "#3B82F6",
      features: [
        { href: "/search", label: isZh ? "球员搜索" : "Player Search", description: isZh ? "按姓名查找任意现役球员" : "Find any active player by name", icon: Sparkles },
        { href: "/rookie-watch", label: isZh ? "新秀关注" : "Rookie Watch", description: isZh ? "顶级一年级与二年级球员" : "Top first- and second-year players", icon: Sparkles },
        { href: "/draft-classes", label: isZh ? "选秀届" : "Draft Classes", description: isZh ? "按选秀年份分组球员" : "Players grouped by draft year", icon: GraduationCap },
        { href: "/by-position", label: isZh ? "按位置" : "By Position", icon: Users, description: isZh ? "后卫 / 锋卫摇摆 / 前锋 / 内线领袖" : "Guards / Wings / Forwards / Big Men leaders" },
        { href: "/by-country", label: isZh ? "按国家" : "By Country", description: isZh ? "联盟全球版图" : "Global representation across the league", icon: Globe },
        { href: "/by-college", label: isZh ? "按学校" : "By College", description: isZh ? "NBA 输送名校与顶尖代表" : "NBA pipeline schools and top performers", icon: School },
        { href: "/compare", label: isZh ? "球员对比" : "Compare", description: isZh ? "两位球员的并排数据对比" : "Side-by-side stat comparison of two players", icon: GitCompareArrows },
      ],
    },
    {
      title: isZh ? "新闻与个人" : "News & Personal",
      eyebrow: isZh ? "联盟动态" : "Around the league",
      color: "#F59E0B",
      features: [
        { href: "/injuries", label: isZh ? "伤病" : "Injuries", description: isZh ? "联盟最新伤病报告" : "Latest injury reports across the league", icon: AlertTriangle },
        { href: "/transactions", label: isZh ? "交易动态" : "Transactions", description: isZh ? "交易、签约、裁员" : "Trades, signings, waivers", icon: ArrowLeftRight },
        { href: "/favorites", label: isZh ? "我的关注" : "Favorites", description: isZh ? "你收藏的球队和球员" : "Your saved teams and players", icon: Heart },
      ],
    },
    {
      title: isZh ? "球迷工具" : "Fan Tools",
      eyebrow: isZh ? "游戏与学习" : "Play & learn",
      color: "#A855F7",
      features: [
        { href: "/quiz", label: isZh ? "NBA 问答" : "NBA Quiz", description: isZh ? "通过头像、数据或球队猜球员" : "Guess players from headshots, stat lines, or teams", icon: HelpCircle },
        { href: "/glossary", label: isZh ? "术语词典" : "Glossary", description: isZh ? "数据与术语解释 · PPG 到 PER" : "Stats and terminology explained · PPG to PER", icon: Book },
      ],
    },
  ];
}

export default async function ExplorePage() {
  const locale = await getLocale();
  const isZh = locale === "zh";
  const categories = buildCategories(isZh);
  const total = categories.reduce((s, c) => s + c.features.length, 0);
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <PageHeader
        eyebrow={isZh ? "索引" : "Index"}
        icon={Compass}
        title={isZh ? "浏览" : "Explore"}
        subtitle={isZh ? `NBATracker 全部功能 · 按主题分类的 ${total} 个页面` : `Every feature on NBATracker · ${total} pages organized by topic`}
      />

      <div className="space-y-6">
        {categories.map((cat) => (
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

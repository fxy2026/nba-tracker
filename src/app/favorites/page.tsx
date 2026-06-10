import type { Metadata } from "next";
import { Heart, Search, ListOrdered, Activity, TrendingUp, Compass } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Breadcrumbs from "@/components/Breadcrumbs";
import RelatedPages from "@/components/RelatedPages";
import { getLocale } from "@/lib/locale";
import FavoritesDashboard from "./FavoritesDashboard";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const isZh = locale === "zh";
  return {
    title: isZh ? "为你 · 我的关注" : "My Feed",
    description: isZh
      ? "你关注的球队与球员的实时动态 — 最近一战、下一场、连胜连败、伤停与最新资讯,一处尽览。"
      : "A live feed of the teams and players you follow — last result, next game, streaks, injuries and the latest headlines, all in one place.",
  };
}

// Thin server wrapper. The personalized feed itself is client-only because
// favorites live in localStorage (unknowable during SSR), so all the live
// data + interactions render inside <FavoritesDashboard/> after mount.
export default async function FavoritesPage() {
  const locale = await getLocale();
  const isZh = locale === "zh";

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <Breadcrumbs
        items={[
          { label: isZh ? "个人" : "Personal" },
          { label: isZh ? "为你" : "My Feed" },
        ]}
      />

      <PageHeader
        eyebrow={isZh ? "为你" : "For You"}
        icon={Heart}
        title={isZh ? "我的关注" : "My Feed"}
        subtitle={
          isZh
            ? "你关注的球队与球员的实时动态 · 仅保存在本机"
            : "Live updates for the teams & players you follow · stored on this device"
        }
      />

      <FavoritesDashboard />

      <RelatedPages
        eyebrow={isZh ? "继续探索" : "Keep exploring"}
        pages={[
          { href: "/search", label: isZh ? "查找球员" : "Find players", icon: Search },
          { href: "/standings", label: isZh ? "排行榜" : "Standings", icon: ListOrdered },
          { href: "/explore", label: isZh ? "探索" : "Explore", icon: Compass },
          { href: "/streaks", label: isZh ? "连胜连败" : "Streaks", icon: Activity },
          { href: "/power-rankings", label: isZh ? "战力榜" : "Power rankings", icon: TrendingUp },
        ]}
      />
    </div>
  );
}

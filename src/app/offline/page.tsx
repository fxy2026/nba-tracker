import Link from "next/link";
import { WifiOff } from "lucide-react";
import { getLocale } from "@/lib/locale";

export const dynamic = "force-static";

export const metadata = {
  title: "Offline — NBA Tracker",
  robots: { index: false, follow: false },
};

export default async function OfflinePage() {
  const locale = await getLocale();
  const isZh = locale === "zh";

  return (
    <div className="max-w-2xl mx-auto px-4 py-16 flex flex-col items-center text-center">
      <div className="rounded-full bg-warning/10 border border-warning/30 p-5 mb-6">
        <WifiOff size={32} className="text-warning" />
      </div>
      <h1 className="text-2xl font-semibold mb-2 text-text-primary">
        {isZh ? "网络已断开" : "You're offline"}
      </h1>
      <p className="text-text-secondary text-sm mb-6 max-w-md">
        {isZh
          ? "我们没法连接到比赛数据。已浏览过的页面可能可以离线查看 — 试试导航到之前看过的比赛或球员。"
          : "We couldn't reach the live data. Pages you've already visited may still work — try navigating to a recent game or player."}
      </p>
      <div className="flex flex-wrap items-center gap-3 text-xs">
        <Link
          href="/"
          className="px-4 py-2 bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
        >
          {isZh ? "返回主页" : "Back to home"}
        </Link>
        <Link
          href="/favorites"
          className="px-4 py-2 bg-bg-card border border-border rounded-lg hover:border-accent/50 transition-colors"
        >
          {isZh ? "我的收藏" : "Favorites"}
        </Link>
      </div>
    </div>
  );
}

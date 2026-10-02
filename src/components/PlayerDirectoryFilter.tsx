import Link from "next/link";
import type { DirectoryFilter } from "@/lib/player-directory-filter";

export default function PlayerDirectoryFilter({ filter, href, locale }: { filter: DirectoryFilter; href: string; locale: string }) {
  if (!filter.value && !filter.invalid) return null;
  const zh = locale === "zh";
  return <div className="mb-5 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
    <p>{filter.value ? `${zh ? "当前筛选" : "Selected filter"}: ${filter.value}` : (zh ? "筛选项无效或不在此快照中，显示全部分组。" : "Filter unavailable in this snapshot or invalid; showing all groups.")}</p>
    <Link href={href} className="text-accent hover:underline">{zh ? "查看全部分组" : "View all groups"}</Link>
  </div>;
}

import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.statsTitle,
    description: t.meta.statsDesc,
  };
}

export default function StatsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.standingsTitle,
    description: t.meta.standingsDesc,
  };
}

export default function StandingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.scheduleTitle,
    description: t.meta.scheduleDesc,
  };
}

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
  return children;
}

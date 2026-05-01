import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.compareTitle,
    description: t.meta.compareDesc,
  };
}

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return children;
}

import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.clutchTitle,
    description: t.meta.clutchDesc,
  };
}

export default function ClutchLayout({ children }: { children: React.ReactNode }) {
  return children;
}

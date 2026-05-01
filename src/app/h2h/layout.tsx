import type { Metadata } from "next";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getLocale();
  const t = getTranslations(locale);
  return {
    title: t.meta.h2hTitle,
    description: t.meta.h2hDesc,
  };
}

export default function H2HLayout({ children }: { children: React.ReactNode }) {
  return children;
}

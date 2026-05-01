import { cookies } from "next/headers";
import type { Locale } from "@/locales";

export async function getLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const val = cookieStore.get("locale")?.value;
  if (val === "en" || val === "zh") return val;
  return "zh";
}

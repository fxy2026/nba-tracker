import Link from "next/link";
import { Home, Search, Trophy } from "lucide-react";
import { getLocale } from "@/lib/locale";
import { getTranslations } from "@/locales";

export default async function NotFound() {
  const locale = await getLocale();
  const t = getTranslations(locale);

  return (
    <div className="max-w-2xl mx-auto px-4 py-20">
      <div className="glass-tile p-10 sm:p-12 text-center relative overflow-hidden">
        {/* Subtle basketball watermark */}
        <svg viewBox="0 0 120 120" className="absolute -right-8 -bottom-8 w-48 h-48 opacity-[0.04] pointer-events-none">
          <circle cx="60" cy="60" r="50" fill="none" stroke="currentColor" strokeWidth="3" />
          <path d="M10,60 Q60,20 110,60" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10,60 Q60,100 110,60" fill="none" stroke="currentColor" strokeWidth="2" />
          <line x1="60" y1="10" x2="60" y2="110" stroke="currentColor" strokeWidth="2" />
        </svg>
        <div className="relative">
          <p className="text-[9px] font-mono uppercase tracking-[0.3em] text-text-secondary/60 mb-3">/ Lost</p>
          <p className="text-[clamp(4rem,10vw,8rem)] font-light font-mono tabular-nums leading-none text-accent-amber tracking-tighter">404</p>
          <h2 className="text-xl sm:text-2xl font-semibold tracking-tight text-text-primary mt-3">{t.errors.notFoundTitle}</h2>
          <p className="text-text-secondary max-w-md mx-auto mt-2">{t.errors.notFoundDesc}</p>
          <p className="text-text-secondary/50 text-xs mt-1 font-mono uppercase tracking-[0.15em]">{t.errors.notFoundHint}</p>
          <div className="flex items-center gap-3 flex-wrap justify-center mt-6">
            <Link
              href="/"
              className="flex items-center gap-2 px-5 py-2.5 bg-accent-gradient text-white rounded-xl text-xs font-bold uppercase tracking-[0.15em] hover:opacity-90 transition-all shadow-lg shadow-accent/30 cursor-pointer"
            >
              <Home size={14} />
              {t.common.home}
            </Link>
            <Link href="/stats" className="chip cursor-pointer">
              <Trophy size={14} /> {t.nav.standings}
            </Link>
            <Link href="/search" className="chip cursor-pointer">
              <Search size={14} /> {t.nav.search}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Home, Search, Trophy } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-16 flex flex-col items-center text-center">
      {/* Basketball SVG */}
      <svg viewBox="0 0 120 120" className="w-24 h-24 mb-6 opacity-20">
        <circle cx="60" cy="60" r="50" fill="none" stroke="var(--text-secondary)" strokeWidth="3" />
        <path d="M10,60 Q60,20 110,60" fill="none" stroke="var(--text-secondary)" strokeWidth="2" />
        <path d="M10,60 Q60,100 110,60" fill="none" stroke="var(--text-secondary)" strokeWidth="2" />
        <line x1="60" y1="10" x2="60" y2="110" stroke="var(--text-secondary)" strokeWidth="2" />
      </svg>
      <div className="text-7xl font-bold text-accent/30 mb-4">404</div>
      <h2 className="text-2xl font-bold mb-2">Air Ball! Page Not Found</h2>
      <p className="text-text-secondary mb-8 max-w-md">
        This shot missed the mark. The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex items-center gap-3 flex-wrap justify-center">
        <Link
          href="/"
          className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white rounded-lg font-medium transition-colors"
        >
          <Home size={16} />
          Home
        </Link>
        <Link
          href="/stats"
          className="flex items-center gap-2 px-5 py-2.5 bg-bg-card border border-border text-text-primary rounded-lg hover:bg-bg-hover transition-colors font-medium"
        >
          <Trophy size={16} />
          Standings
        </Link>
        <Link
          href="/search"
          className="flex items-center gap-2 px-5 py-2.5 bg-bg-card border border-border text-text-primary rounded-lg hover:bg-bg-hover transition-colors font-medium"
        >
          <Search size={16} />
          Search
        </Link>
      </div>
    </div>
  );
}

import { Play, ExternalLink } from "lucide-react";
import { getReplayLinks } from "@/lib/supabase";
import type { Translations } from "@/locales";

export default async function ReplaySection({ gameId, t }: { gameId: string; t: Translations }) {
  const replayLinks = await getReplayLinks(gameId).catch(() => []);
  if (replayLinks.length === 0) return null;
  return (
    <div className="bg-bg-card rounded-xl border border-accent/30 p-4 mt-4">
      <h3 className="text-sm font-semibold text-accent flex items-center gap-1.5 mb-3">
        <Play size={14} fill="currentColor" />
        {t.gameDetail.gameReplay}
      </h3>
      <div className="flex flex-wrap gap-2">
        {replayLinks.map((link) => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-2 bg-bg-hover rounded-lg text-sm text-text-primary hover:bg-accent/20 hover:text-accent transition-colors"
          >
            <ExternalLink size={14} />
            {link.title}
            <span className="text-xs text-text-secondary ml-1">({link.source})</span>
          </a>
        ))}
      </div>
    </div>
  );
}

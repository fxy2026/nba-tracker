import Link from "next/link";
import TeamLogo from "@/components/TeamLogo";
import GameCountdown from "@/components/GameCountdown";

interface PreGameTeam {
  teamId: number;
  teamTricode: string;
  teamCity: string;
  teamName: string;
}

// Shared "Upcoming + countdown + matchup" header for any not-yet-tipped game,
// so the pre-game experience is identical whether or not the CDN has published
// the box-score shell yet. Fed from either a ScheduleGame or a BoxScore — both
// expose the same team fields.
export default function PreGameHero({
  away,
  home,
  gameTimeUTC,
  beijingTime,
  isZh,
}: {
  away: PreGameTeam;
  home: PreGameTeam;
  gameTimeUTC: string;
  beijingTime: string | null;
  isZh: boolean;
}) {
  return (
    <div className="glass-tile glass-tile-featured p-5 sm:p-6 mt-4">
      <div className="flex items-center justify-between mb-4 gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">
          <span>{isZh ? "未开始" : "Upcoming"}</span>
          {beijingTime && <span className="text-text-secondary/60">· {beijingTime}</span>}
        </div>
        <GameCountdown gameTimeUTC={gameTimeUTC} />
      </div>
      <div className="flex items-center justify-center gap-6 sm:gap-10 py-4">
        <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
          <TeamLogo teamId={away.teamId} tricode={away.teamTricode} size={64} />
          <Link href={`/team/${away.teamTricode}`} className="text-center hover:text-accent transition-colors">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">Away</p>
            <p className="font-bold text-sm">{away.teamCity}</p>
            <p className="font-bold text-sm">{away.teamName}</p>
          </Link>
        </div>
        <span className="text-3xl sm:text-4xl font-extralight text-text-secondary/30">–</span>
        <div className="flex flex-col items-center gap-2 flex-1 max-w-[180px]">
          <TeamLogo teamId={home.teamId} tricode={home.teamTricode} size={64} />
          <Link href={`/team/${home.teamTricode}`} className="text-center hover:text-accent transition-colors">
            <p className="text-[10px] font-mono uppercase tracking-[0.2em] text-text-secondary">Home</p>
            <p className="font-bold text-sm">{home.teamCity}</p>
            <p className="font-bold text-sm">{home.teamName}</p>
          </Link>
        </div>
      </div>
    </div>
  );
}

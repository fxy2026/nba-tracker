import TeamLogo from "@/components/TeamLogo";
import StatsTable from "./StatsTable";
import type { BoxScoreTeam, ShotAction, PlayerInfo } from "@/lib/api";
import type { Translations } from "@/locales";

export default function BoxScoreSection({
  team,
  shots,
  playerInfoMap,
  t,
}: {
  team: BoxScoreTeam;
  shots: ShotAction[];
  playerInfoMap: Map<number, PlayerInfo>;
  t: Translations;
}) {
  return (
    <div className="glass-tile overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center gap-2">
        <TeamLogo teamId={team.teamId} tricode={team.teamTricode} size={24} />
        <h2 className="font-semibold">
          {team.teamCity} {team.teamName}
        </h2>
        <span className="text-text-secondary text-sm ml-auto">{team.score} pts</span>
      </div>
      <StatsTable players={team.players} shots={shots} playerInfoMap={playerInfoMap} t={t} />
    </div>
  );
}

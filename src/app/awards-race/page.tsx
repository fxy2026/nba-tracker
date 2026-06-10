import { ICONIC_SEASONS } from "@/lib/iconicSeasons";
import AwardsRaceClient, { type MvpSeason } from "./AwardsRaceClient";

export default function AwardsRacePage() {
  const mvpSeasons: MvpSeason[] = [...ICONIC_SEASONS]
    .filter((s) => s.mvp)
    .sort((a, b) => b.seasonYear - a.seasonYear)
    .slice(0, 16)
    .map((s) => ({
      id: s.id,
      personId: s.personId,
      name: s.name,
      season: s.season,
      ppg: s.ppg,
      rpg: s.rpg,
      apg: s.apg,
      champion: Boolean(s.champion),
    }));

  return <AwardsRaceClient mvpSeasons={mvpSeasons} />;
}

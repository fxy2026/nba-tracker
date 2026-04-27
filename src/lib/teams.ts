export interface TeamMeta {
  teamId: number;
  tricode: string;
  city: string;
  name: string;
  conference: "East" | "West";
  division: string;
}

export const TEAM_META: Record<string, TeamMeta> = {
  ATL: { teamId: 1610612737, tricode: "ATL", city: "Atlanta", name: "Hawks", conference: "East", division: "Southeast" },
  BOS: { teamId: 1610612738, tricode: "BOS", city: "Boston", name: "Celtics", conference: "East", division: "Atlantic" },
  BKN: { teamId: 1610612751, tricode: "BKN", city: "Brooklyn", name: "Nets", conference: "East", division: "Atlantic" },
  CHA: { teamId: 1610612766, tricode: "CHA", city: "Charlotte", name: "Hornets", conference: "East", division: "Southeast" },
  CHI: { teamId: 1610612741, tricode: "CHI", city: "Chicago", name: "Bulls", conference: "East", division: "Central" },
  CLE: { teamId: 1610612739, tricode: "CLE", city: "Cleveland", name: "Cavaliers", conference: "East", division: "Central" },
  DAL: { teamId: 1610612742, tricode: "DAL", city: "Dallas", name: "Mavericks", conference: "West", division: "Southwest" },
  DEN: { teamId: 1610612743, tricode: "DEN", city: "Denver", name: "Nuggets", conference: "West", division: "Northwest" },
  DET: { teamId: 1610612765, tricode: "DET", city: "Detroit", name: "Pistons", conference: "East", division: "Central" },
  GSW: { teamId: 1610612744, tricode: "GSW", city: "Golden State", name: "Warriors", conference: "West", division: "Pacific" },
  HOU: { teamId: 1610612745, tricode: "HOU", city: "Houston", name: "Rockets", conference: "West", division: "Southwest" },
  IND: { teamId: 1610612754, tricode: "IND", city: "Indiana", name: "Pacers", conference: "East", division: "Central" },
  LAC: { teamId: 1610612746, tricode: "LAC", city: "LA", name: "Clippers", conference: "West", division: "Pacific" },
  LAL: { teamId: 1610612747, tricode: "LAL", city: "Los Angeles", name: "Lakers", conference: "West", division: "Pacific" },
  MEM: { teamId: 1610612763, tricode: "MEM", city: "Memphis", name: "Grizzlies", conference: "West", division: "Southwest" },
  MIA: { teamId: 1610612748, tricode: "MIA", city: "Miami", name: "Heat", conference: "East", division: "Southeast" },
  MIL: { teamId: 1610612749, tricode: "MIL", city: "Milwaukee", name: "Bucks", conference: "East", division: "Central" },
  MIN: { teamId: 1610612750, tricode: "MIN", city: "Minnesota", name: "Timberwolves", conference: "West", division: "Northwest" },
  NOP: { teamId: 1610612740, tricode: "NOP", city: "New Orleans", name: "Pelicans", conference: "West", division: "Southwest" },
  NYK: { teamId: 1610612752, tricode: "NYK", city: "New York", name: "Knicks", conference: "East", division: "Atlantic" },
  OKC: { teamId: 1610612760, tricode: "OKC", city: "Oklahoma City", name: "Thunder", conference: "West", division: "Northwest" },
  ORL: { teamId: 1610612753, tricode: "ORL", city: "Orlando", name: "Magic", conference: "East", division: "Southeast" },
  PHI: { teamId: 1610612755, tricode: "PHI", city: "Philadelphia", name: "76ers", conference: "East", division: "Atlantic" },
  PHX: { teamId: 1610612756, tricode: "PHX", city: "Phoenix", name: "Suns", conference: "West", division: "Pacific" },
  POR: { teamId: 1610612757, tricode: "POR", city: "Portland", name: "Trail Blazers", conference: "West", division: "Northwest" },
  SAC: { teamId: 1610612758, tricode: "SAC", city: "Sacramento", name: "Kings", conference: "West", division: "Pacific" },
  SAS: { teamId: 1610612759, tricode: "SAS", city: "San Antonio", name: "Spurs", conference: "West", division: "Southwest" },
  TOR: { teamId: 1610612761, tricode: "TOR", city: "Toronto", name: "Raptors", conference: "East", division: "Atlantic" },
  UTA: { teamId: 1610612762, tricode: "UTA", city: "Utah", name: "Jazz", conference: "West", division: "Northwest" },
  WAS: { teamId: 1610612764, tricode: "WAS", city: "Washington", name: "Wizards", conference: "East", division: "Southeast" },
};

export function getTeamByTricode(tricode: string): TeamMeta | null {
  return TEAM_META[tricode.toUpperCase()] || null;
}

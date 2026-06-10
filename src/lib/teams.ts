export interface TeamMeta {
  teamId: number;
  tricode: string;
  city: string;
  name: string;
  conference: "East" | "West";
  division: string;
  primaryColor: string;
}

export const TEAM_META: Record<string, TeamMeta> = {
  ATL: { teamId: 1610612737, tricode: "ATL", city: "Atlanta", name: "Hawks", conference: "East", division: "Southeast", primaryColor: "#C8102E" },
  BOS: { teamId: 1610612738, tricode: "BOS", city: "Boston", name: "Celtics", conference: "East", division: "Atlantic", primaryColor: "#007A33" },
  BKN: { teamId: 1610612751, tricode: "BKN", city: "Brooklyn", name: "Nets", conference: "East", division: "Atlantic", primaryColor: "#000000" },
  CHA: { teamId: 1610612766, tricode: "CHA", city: "Charlotte", name: "Hornets", conference: "East", division: "Southeast", primaryColor: "#1D1160" },
  CHI: { teamId: 1610612741, tricode: "CHI", city: "Chicago", name: "Bulls", conference: "East", division: "Central", primaryColor: "#CE1141" },
  CLE: { teamId: 1610612739, tricode: "CLE", city: "Cleveland", name: "Cavaliers", conference: "East", division: "Central", primaryColor: "#860038" },
  DAL: { teamId: 1610612742, tricode: "DAL", city: "Dallas", name: "Mavericks", conference: "West", division: "Southwest", primaryColor: "#00538C" },
  DEN: { teamId: 1610612743, tricode: "DEN", city: "Denver", name: "Nuggets", conference: "West", division: "Northwest", primaryColor: "#0E2240" },
  DET: { teamId: 1610612765, tricode: "DET", city: "Detroit", name: "Pistons", conference: "East", division: "Central", primaryColor: "#C8102E" },
  GSW: { teamId: 1610612744, tricode: "GSW", city: "Golden State", name: "Warriors", conference: "West", division: "Pacific", primaryColor: "#1D428A" },
  HOU: { teamId: 1610612745, tricode: "HOU", city: "Houston", name: "Rockets", conference: "West", division: "Southwest", primaryColor: "#CE1141" },
  IND: { teamId: 1610612754, tricode: "IND", city: "Indiana", name: "Pacers", conference: "East", division: "Central", primaryColor: "#002D62" },
  LAC: { teamId: 1610612746, tricode: "LAC", city: "LA", name: "Clippers", conference: "West", division: "Pacific", primaryColor: "#C8102E" },
  LAL: { teamId: 1610612747, tricode: "LAL", city: "Los Angeles", name: "Lakers", conference: "West", division: "Pacific", primaryColor: "#552583" },
  MEM: { teamId: 1610612763, tricode: "MEM", city: "Memphis", name: "Grizzlies", conference: "West", division: "Southwest", primaryColor: "#5D76A9" },
  MIA: { teamId: 1610612748, tricode: "MIA", city: "Miami", name: "Heat", conference: "East", division: "Southeast", primaryColor: "#98002E" },
  MIL: { teamId: 1610612749, tricode: "MIL", city: "Milwaukee", name: "Bucks", conference: "East", division: "Central", primaryColor: "#00471B" },
  MIN: { teamId: 1610612750, tricode: "MIN", city: "Minnesota", name: "Timberwolves", conference: "West", division: "Northwest", primaryColor: "#0C2340" },
  NOP: { teamId: 1610612740, tricode: "NOP", city: "New Orleans", name: "Pelicans", conference: "West", division: "Southwest", primaryColor: "#0C2340" },
  NYK: { teamId: 1610612752, tricode: "NYK", city: "New York", name: "Knicks", conference: "East", division: "Atlantic", primaryColor: "#006BB6" },
  OKC: { teamId: 1610612760, tricode: "OKC", city: "Oklahoma City", name: "Thunder", conference: "West", division: "Northwest", primaryColor: "#007AC1" },
  ORL: { teamId: 1610612753, tricode: "ORL", city: "Orlando", name: "Magic", conference: "East", division: "Southeast", primaryColor: "#0077C0" },
  PHI: { teamId: 1610612755, tricode: "PHI", city: "Philadelphia", name: "76ers", conference: "East", division: "Atlantic", primaryColor: "#006BB6" },
  PHX: { teamId: 1610612756, tricode: "PHX", city: "Phoenix", name: "Suns", conference: "West", division: "Pacific", primaryColor: "#1D1160" },
  POR: { teamId: 1610612757, tricode: "POR", city: "Portland", name: "Trail Blazers", conference: "West", division: "Northwest", primaryColor: "#E03A3E" },
  SAC: { teamId: 1610612758, tricode: "SAC", city: "Sacramento", name: "Kings", conference: "West", division: "Pacific", primaryColor: "#5A2D81" },
  SAS: { teamId: 1610612759, tricode: "SAS", city: "San Antonio", name: "Spurs", conference: "West", division: "Southwest", primaryColor: "#C4CED4" },
  TOR: { teamId: 1610612761, tricode: "TOR", city: "Toronto", name: "Raptors", conference: "East", division: "Atlantic", primaryColor: "#CE1141" },
  UTA: { teamId: 1610612762, tricode: "UTA", city: "Utah", name: "Jazz", conference: "West", division: "Northwest", primaryColor: "#002B5C" },
  WAS: { teamId: 1610612764, tricode: "WAS", city: "Washington", name: "Wizards", conference: "East", division: "Southeast", primaryColor: "#002B5C" },
};

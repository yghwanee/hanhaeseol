export interface StreakInfo {
  type: "W" | "L" | "D";
  count: number;
}

export interface EplStanding {
  rank: number;
  teamName: string;
  teamLogo: string | null;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
  goals: number;
  goalsConceded: number;
  goalsDifference: number;
  points: number;
  /** "WWWLL" — index 0이 가장 최근 경기 */
  lastFive: string;
  streak: StreakInfo;
  /** "UEFA Champions League" / "UEFA Europa League" / "Relegation Zone" 등 진출/강등 상태 */
  rankStatus: string | null;
}

export interface KboStanding {
  rank: number;
  teamName: string;
  teamLogo: string | null;
  gameCount: number;
  win: number;
  draw: number;
  lose: number;
  /** 0~1 */
  winRate: number;
  gameBehind: number;
  lastFive: string;
  streak: StreakInfo;
}

export interface StandingsData {
  epl: {
    season: string;
    teams: EplStanding[];
  } | null;
  kbo: {
    season: string;
    teams: KboStanding[];
  } | null;
  lastUpdated: string;
}

export interface StreakInfo {
  type: "W" | "L" | "D";
  count: number;
}

export interface SoccerStanding {
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
  /** "UEFA Champions League" / "UEFA Europa League" / "Relegation Zone" 등 */
  rankStatus: string | null;
}

export interface BaseballStanding {
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
  /** MLB만: "AL" | "NL". KBO 등은 undefined */
  league?: string;
  /** MLB만: "EAST" | "CENTRAL" | "WEST". KBO 등은 undefined */
  division?: string;
}

export interface BasketballStanding {
  rank: number;
  teamName: string;
  teamLogo: string | null;
  gameCount: number;
  win: number;
  lose: number;
  /** 0~1 */
  winRate: number;
  gameBehind: number;
  lastFive: string;
  streak: StreakInfo;
}

export type SoccerLeagueId =
  | "epl"
  | "primera"
  | "bundesliga"
  | "seria"
  | "ligue1"
  | "champs"
  | "europa"
  | "mls"
  | "kleague"
  | "kleague2"
  | "eredivisie";

export type BaseballLeagueId = "kbo" | "mlb";

export type BasketballLeagueId = "nba" | "kbl";

export interface SoccerLeagueStandings {
  id: SoccerLeagueId;
  name: string;
  /** 사이트 내 별도 URL이 있는 경우(/league/{slug}) 편성표로 연결 */
  scheduleSlug?: string;
  season: string;
  teams: SoccerStanding[];
}

export interface BaseballLeagueStandings {
  id: BaseballLeagueId;
  name: string;
  scheduleSlug?: string;
  season: string;
  teams: BaseballStanding[];
}

export interface BasketballLeagueStandings {
  id: BasketballLeagueId;
  name: string;
  scheduleSlug?: string;
  season: string;
  teams: BasketballStanding[];
}

export interface StandingsData {
  soccer: SoccerLeagueStandings[];
  baseball: BaseballLeagueStandings[];
  basketball: BasketballLeagueStandings[];
  lastUpdated: string;
}

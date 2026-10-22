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
  /** MLS만: "EAST" | "WEST" (네이버 league 필드). 다른 리그는 undefined */
  conference?: string;
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
  /** NBA: 「동부」·「서부」. 순위가 컨퍼런스 단위다. */
  conference?: string;
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

export type VolleyballLeagueId = "kovo" | "wkovo";

export interface VolleyballStanding {
  rank: number;
  teamName: string;
  teamLogo: string | null;
  gameCount: number;
  win: number;
  lose: number;
  /** 승점 — V리그 순위 기준 */
  points: number;
  /** 세트 득실률 */
  setRatio: number;
  lastFive: string;
  streak: StreakInfo;
}

export interface VolleyballLeagueStandings {
  id: VolleyballLeagueId;
  name: string;
  scheduleSlug?: string;
  season: string;
  teams: VolleyballStanding[];
}

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
  /** V리그. 시즌 중(네이버 isSeason=Y)일 때만 채운다 — 비시즌엔 비거나 없다. */
  volleyball?: VolleyballLeagueStandings[];
  lastUpdated: string;
}

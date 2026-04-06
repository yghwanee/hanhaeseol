export type Sport = "축구" | "야구" | "농구" | "배구";

export type Platform =
  | "SPOTV NOW"
  | "SPOTV"
  | "SPOTV2"
  | "쿠팡플레이"
  | "티빙"
  | "tvN SPORTS"
  | "KBS N SPORTS"
  | "MBC SPORTS+"
  | "SBS Sports"
  | "Apple TV+";

export interface Schedule {
  id: string;
  date: string;
  time: string;
  sport: Sport;
  league: string;
  homeTeam: string;
  awayTeam: string;
  platform: Platform;
  koreanCommentary: boolean | "unknown";
}

export interface ScheduleData {
  lastUpdated: string;
  schedules: Schedule[];
}

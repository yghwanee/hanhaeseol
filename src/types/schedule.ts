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
  | "Apple TV+"
  | "JTBC";

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
  /** 국기/엠블럼 이미지 URL (현재 월드컵 국가대표 경기에만 채워짐). */
  homeEmblem?: string;
  awayEmblem?: string;
}

export interface ScheduleData {
  lastUpdated: string;
  schedules: Schedule[];
}

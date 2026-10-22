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
  /**
   * 홈 화면이 같은 경기를 한 카드로 접을 때 붙인다(`groupSameGame`). 이 경기를 중계하는 모든
   * 채널과 채널별 해설. 데이터 파일에는 없다 — 화면에서만 만든다.
   */
  coverage?: { platform: Platform; koreanCommentary: boolean | "unknown" }[];
}

export interface ScheduleData {
  lastUpdated: string;
  schedules: Schedule[];
}

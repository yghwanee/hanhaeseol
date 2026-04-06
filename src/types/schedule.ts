export interface Schedule {
  id: string;
  date: string;
  time: string;
  sport: "축구" | "야구";
  league: string;
  homeTeam: string;
  awayTeam: string;
  platform: "SPOTV" | "쿠팡플레이" | "티빙";
  koreanCommentary: boolean | "unknown";
}

export interface ScheduleData {
  lastUpdated: string;
  schedules: Schedule[];
}

export interface TeamRecord {
  /** 최근 5경기 결과. 5자 문자열, "WWLWL" 형태. W=승, L=패, D/T=무. 경기 수가 적으면 5자보다 짧을 수 있다. */
  last5: string;
  /** 시즌 누적 승수 */
  win: number;
  /** 시즌 누적 패수 */
  lose: number;
  /** 시즌 누적 무승부 (KBO 등) */
  draw?: number;
  /** 승률 (예: 0.68) */
  wra?: number;
}

/** 리그명 → (팀명 → 기록). 팀명은 schedule.json과 같은 한국어 표기를 사용한다. */
export type TeamRecordsMap = Record<string, Record<string, TeamRecord>>;

export interface TeamRecordsData {
  lastUpdated: string;
  records: TeamRecordsMap;
}

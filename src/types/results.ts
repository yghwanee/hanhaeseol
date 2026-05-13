// 네이버 스포츠에서 가져온 경기 결과(또는 진행 중) 데이터.
// 편성표(schedule.json)의 카드에 스코어로 매칭 표시하기 위한 목적.

export type GameStatus =
  | "scheduled" // 시작 전
  | "live" // 진행 중
  | "finished" // 종료
  | "canceled" // 취소
  | "postponed"; // 연기

export interface MatchResult {
  /** YYYY-MM-DD (KST) */
  date: string;
  /** 네이버 categoryId. ex) "epl", "kbo", "nba" */
  categoryId: string;
  /** schedule.json 표기로 정규화된 홈팀명 */
  homeTeam: string;
  /** schedule.json 표기로 정규화된 원정팀명 */
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: GameStatus;
  /** 라이브용 표기. 예: "9회말", "전반전", "3쿼터". 없으면 생략. */
  period?: string;
}

export interface ResultsData {
  lastUpdated: string;
  /** 매칭용 룩업 키 → 결과. 키 포맷: `${date}|${categoryId}|${homeTeam}|${awayTeam}` (모든 alias 변형 포함) */
  byKey: Record<string, MatchResult>;
  /** 디버깅·표시용 전체 결과 목록 (중복 alias 없이) */
  results: MatchResult[];
}

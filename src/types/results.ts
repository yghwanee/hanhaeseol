// 네이버 스포츠에서 가져온 경기 결과(또는 진행 중) 데이터.
// 편성표(schedule.json)의 카드에 스코어로 매칭 표시하기 위한 목적.

export type GameStatus =
  | "scheduled" // 시작 전
  | "live" // 진행 중
  | "finished" // 종료
  | "canceled" // 취소
  | "postponed"; // 연기

/** 축구 득점 이벤트 (네이버 game.scorers 기반). 카드/매치페이지에 득점자·시간 표시용. */
export interface GoalEvent {
  /** 득점이 기록된 팀(스코어가 올라가는 쪽). 자책골도 이득을 본 팀 기준. */
  team: "home" | "away";
  /** 득점자 이름 */
  player: string;
  /** 득점 시간(분). 예: 41 → 41' */
  minute: number;
  /** 추가시간(분). 있으면 45+2' 처럼 표기. 없으면 생략. */
  addedTime?: number;
  /** 자책골 여부 */
  ownGoal?: boolean;
}

export interface MatchResult {
  /** YYYY-MM-DD (KST) */
  date: string;
  /** 네이버 categoryId. ex) "epl", "kbo", "nba" */
  categoryId: string;
  /** 네이버 gameId. 라인업 등 경기별 상세(/api/lineup) 호출용. 목록 응답에서 수집. */
  gameId?: string;
  /** schedule.json 표기로 정규화된 홈팀명 */
  homeTeam: string;
  /** schedule.json 표기로 정규화된 원정팀명 */
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  status: GameStatus;
  /** 라이브용 표기. 예: "9회말", "전반전", "3쿼터". 없으면 생략. */
  period?: string;
  /** 축구 한정: 득점자·득점시간 목록(시간순). 골 없으면 생략. */
  goals?: GoalEvent[];
  /**
   * 승부차기 점수. 정규+연장이 무승부로 끝나 승부차기로 갈린 경기에만 존재.
   * 네이버 detail의 homePtScore/awayPtScore 기반. 표시: "1-1 (승부차기 4-3)".
   */
  homePtScore?: number;
  awayPtScore?: number;
  /**
   * 승부차기 등으로 갈린 최종 승자. 스코어가 같아도(1-1) 이 값으로 승패를 표시한다.
   * 스코어로 승패가 결정되는 일반 경기에는 채우지 않음(스코어로 충분).
   */
  winner?: "home" | "away";
}

export interface ResultsData {
  lastUpdated: string;
  /** 매칭용 룩업 키 → 결과. 키 포맷: `${date}|${categoryId}|${homeTeam}|${awayTeam}` (모든 alias 변형 포함) */
  byKey: Record<string, MatchResult>;
  /** 디버깅·표시용 전체 결과 목록 (중복 alias 없이) */
  results: MatchResult[];
}

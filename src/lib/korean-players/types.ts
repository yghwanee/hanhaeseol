export interface KoreanPlayer {
  /** 한국어 표기 이름 */
  name: string;
  /** 대표 팀명 (schedule.json 표기 우선) */
  team: string;
  /** schedule.json 에서 같은 팀이 쓰는 모든 표기. 매칭은 이 목록으로 한다. */
  teams: string[];
  /** schedule.json 리그명 */
  league: string;
  /** 어디서 확인했는지 */
  source: "naver" | "mlb-statsapi";
}

export interface KoreanPlayersData {
  /** 크롤 시각(UTC ISO). 오래되면 소비측이 로스터를 통째로 무시한다. */
  generatedAt: string;
  players: KoreanPlayer[];
  /** schedule 표기로 못 옮긴 팀명(운영 참고용). 매칭 실패는 "점수 손실"일 뿐 오보가 아니다. */
  unresolvedTeams: string[];
}

// 선발투수 한 명의 시즌 성적. whip은 KBO만 제공(MLB 응답엔 없음) → optional.
export interface StarterStat {
  name: string;
  era: string; // 네이버 원본 문자열 보존 (예 "3.45")
  ip: string;  // 포맷된 이닝 (예 "57⅓"); 데이터 없으면 ""
  w: number;
  l: number;
  so: number;  // 탈삼진 (네이버 kk)
  whip?: string;
}

// 한 경기의 양 팀 선발. teams는 정규화된 팀명 -> 성적.
export interface MatchStarters {
  league: "kbo" | "mlb";
  teams: Record<string, StarterStat>;
}

export interface StartersData {
  lastUpdated: string;
  starters: Record<string, MatchStarters>;
}

// 렌더용 — 특정 경기의 홈/원정 선발(없으면 null).
export interface MatchStarterView {
  home: StarterStat | null;
  away: StarterStat | null;
}

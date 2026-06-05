// 2026 북중미 월드컵 조별 순위 (네이버 statistics teams API 기반).
export interface WorldCupGroupTeam {
  name: string;
  rank: number; // 조 내 순위
  played: number;
  win: number;
  draw: number;
  loss: number;
  gf: number; // 득점
  ga: number; // 실점
  gd: number; // 골득실
  points: number;
  emblem?: string; // 국기
  /** 16강(조별리그 통과) 진출 확률 %. 네이버 시뮬레이션. */
  advanceProb?: number;
}

export interface WorldCupGroup {
  group: string; // "A" ~ "L"
  teams: WorldCupGroupTeam[];
}

export interface WorldCupStandings {
  lastUpdated: string;
  groups: WorldCupGroup[];
}

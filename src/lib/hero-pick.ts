import type { Schedule, Sport } from "@/types/schedule";

// 한국 선수 → 소속 팀 (시즌마다 갱신 필요)
// schedule.json의 팀명 표기와 일치해야 함.
export const KOREAN_PLAYERS: Array<{ name: string; team: string }> = [
  // 축구 — 유럽
  { name: "황희찬", team: "울버햄튼" },
  { name: "이강인", team: "PSG" },
  { name: "김민재", team: "바이에른 뮌헨" },
  { name: "양민혁", team: "토트넘" },
  { name: "정우영", team: "슈투트가르트" },
  // 야구 — MLB
  { name: "김혜성", team: "LA 다저스" },
  { name: "이정후", team: "샌프란시스코 자이언츠" },
  { name: "김하성", team: "탬파베이 레이스" },
  { name: "배지환", team: "피츠버그 파이리츠" },
];

const KOREAN_PLAYER_TEAMS = new Set(KOREAN_PLAYERS.map((p) => p.team));

const HERO_LEAGUE_PRIORITY = [
  "프리미어리그",
  "챔피언스리그",
  "유로파리그",
  "라리가",
  "분데스리가",
  "세리에A",
  "리그 1",
  "MLB",
  "K리그",
  "K리그2",
  "ACL",
  "KBO",
  "MLS",
  "NBA",
  "KBL",
  "WKBL",
  "잉글랜드 FA컵",
  "EFL 챔피언십",
  "컨퍼런스리그",
];

function hasKoreanPlayer(m: Schedule): boolean {
  if (KOREAN_PLAYER_TEAMS.has(m.homeTeam)) return true;
  if (m.awayTeam && KOREAN_PLAYER_TEAMS.has(m.awayTeam)) return true;
  return false;
}

function leagueRank(lg: string): number {
  const i = HERO_LEAGUE_PRIORITY.indexOf(lg);
  return i === -1 ? HERO_LEAGUE_PRIORITY.length : i;
}

// 1순위: 한국 선수 출전 매치 (제목 클릭 유인 효과). 2순위: 리그 우선순위.
// 같은 우선순위 내에서는 이른 경기 먼저.
export function pickHeroMatch(matches: Schedule[]): Schedule | null {
  if (matches.length === 0) return null;
  const sorted = [...matches].sort((a, b) => {
    const pa = hasKoreanPlayer(a) ? 0 : 1;
    const pb = hasKoreanPlayer(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ra = leagueRank(a.league);
    const rb = leagueRank(b.league);
    if (ra !== rb) return ra - rb;
    return a.time.localeCompare(b.time);
  });
  return sorted[0];
}

// hero 매치 + 다른 종목 우선으로 빅매치 N개. 종목 다양성을 우선 보장하고,
// max가 안 차면 같은 종목으로도 채워서 약속한 개수는 맞춤.
// 캡션/설명용 "빅매치 라인" 생성에서 매일 다양한 매치업을 노출하기 위해 사용.
export function pickHeroMatchesTop(matches: Schedule[], max: number): Schedule[] {
  if (matches.length === 0 || max <= 0) return [];

  const sorted = [...matches].sort((a, b) => {
    const pa = hasKoreanPlayer(a) ? 0 : 1;
    const pb = hasKoreanPlayer(b) ? 0 : 1;
    if (pa !== pb) return pa - pb;
    const ra = leagueRank(a.league);
    const rb = leagueRank(b.league);
    if (ra !== rb) return ra - rb;
    return a.time.localeCompare(b.time);
  });

  const out: Schedule[] = [];
  const seenSports = new Set<Sport>();
  // 1차: 종목당 1개씩 픽
  for (const m of sorted) {
    if (out.length >= max) break;
    if (seenSports.has(m.sport)) continue;
    out.push(m);
    seenSports.add(m.sport);
  }
  // 2차: max 안 차면 남은 매치로 채움
  for (const m of sorted) {
    if (out.length >= max) break;
    if (out.includes(m)) continue;
    out.push(m);
  }
  return out;
}

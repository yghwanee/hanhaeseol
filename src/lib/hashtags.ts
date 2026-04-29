import fs from "node:fs";
import type { Sport } from "@/types/schedule";

// 종목 → 해시태그 (대분류)
const SPORT_HASHTAGS: Record<Sport, string> = {
  축구: "#축구",
  야구: "#야구",
  농구: "#농구",
  배구: "#배구",
};

// 리그 → 해시태그 (중분류)
// 한국어 해설이 실제로 있는 리그만 매핑. 매핑 없으면 자연스럽게 빠짐.
const LEAGUE_HASHTAGS: Record<string, string> = {
  // 축구
  프리미어리그: "#프리미어리그",
  라리가: "#라리가",
  분데스리가: "#분데스리가",
  세리에A: "#세리에A",
  "리그 1": "#리그앙",
  챔피언스리그: "#챔피언스리그",
  유로파리그: "#유로파리그",
  컨퍼런스리그: "#컨퍼런스리그",
  K리그: "#K리그",
  K리그2: "#K리그2",
  ACL: "#ACL",
  MLS: "#MLS",
  "잉글랜드 FA컵": "#FA컵",
  "EFL 챔피언십": "#EFL",
  쉬페르리그: "#쉬페르리그",
  "북중미 챔피언스컵": "#북중미챔스",
  // 야구
  MLB: "#MLB",
  KBO: "#KBO",
  // 농구
  NBA: "#NBA",
  KBL: "#KBL",
  WKBL: "#WKBL",
  일본프로농구: "#B리그",
};

// 종목별 리그 우선순위 (시청자 풀 큰 순)
const LEAGUE_PRIORITY: Record<Sport, string[]> = {
  축구: [
    "챔피언스리그",
    "유로파리그",
    "컨퍼런스리그",
    "프리미어리그",
    "라리가",
    "분데스리가",
    "세리에A",
    "리그 1",
    "잉글랜드 FA컵",
    "K리그",
    "K리그2",
    "EFL 챔피언십",
    "ACL",
    "MLS",
    "북중미 챔피언스컵",
    "쉬페르리그",
  ],
  야구: ["MLB", "KBO"],
  농구: ["NBA", "KBL", "WKBL", "일본프로농구"],
  배구: [],
};

// 팀 → 해시태그 (소분류 niche)
// schedule.json의 실제 팀명 표기 기준. 매핑 없으면 빠짐.
const TEAM_HASHTAGS: Record<string, string> = {
  // EPL
  토트넘: "#토트넘",
  맨유: "#맨유",
  맨시티: "#맨시티",
  리버풀: "#리버풀",
  첼시: "#첼시",
  아스날: "#아스날",
  울버햄튼: "#울버햄튼",
  뉴캐슬: "#뉴캐슬",
  브라이튼: "#브라이튼",
  브렌트포드: "#브렌트포드",
  웨스트햄: "#웨스트햄",
  "아스톤 빌라": "#아스톤빌라",
  "노팅엄 포레스트": "#노팅엄",
  // 라리가
  바르셀로나: "#바르셀로나",
  "레알 마드리드": "#레알마드리드",
  "AT.마드리드": "#아틀레티코마드리드",
  "아틀레티코 마드리드": "#아틀레티코마드리드",
  세비야: "#세비야",
  "레알 소시에다드": "#레알소시에다드",
  비야레알: "#비야레알",
  발렌시아: "#발렌시아",
  지로나: "#지로나",
  // 분데스리가
  "바이에른 뮌헨": "#바이에른뮌헨",
  도르트문트: "#도르트문트",
  슈투트가르트: "#슈투트가르트",
  레버쿠젠: "#레버쿠젠",
  프랑크푸르트: "#프랑크푸르트",
  // 세리에A
  유벤투스: "#유벤투스",
  "인터 밀란": "#인터밀란",
  "AC 밀란": "#AC밀란",
  나폴리: "#나폴리",
  "AS 로마": "#AS로마",
  아탈란타: "#아탈란타",
  라치오: "#라치오",
  // 리그 1
  PSG: "#PSG",
  "파리 생제르망": "#PSG",
  마르세유: "#마르세유",
  모나코: "#모나코",
  // K리그
  울산: "#울산현대",
  전북: "#전북현대",
  포항: "#포항스틸러스",
  서울: "#FC서울",
  FC서울: "#FC서울",
  수원FC: "#수원FC",
  강원: "#강원FC",
  // KBO
  LG: "#LG트윈스",
  KIA: "#KIA타이거즈",
  두산: "#두산베어스",
  삼성: "#삼성라이온즈",
  SSG: "#SSG랜더스",
  롯데: "#롯데자이언츠",
  한화: "#한화이글스",
  NC: "#NC다이노스",
  KT: "#KT위즈",
  키움: "#키움히어로즈",
  // MLB
  "LA 다저스": "#다저스",
  "샌프란시스코 자이언츠": "#자이언츠",
  "탬파베이 레이스": "#탬파베이",
  "샌디에이고 파드리스": "#파드리스",
  "피츠버그 파이리츠": "#파이리츠",
  "마이애미 말린스": "#말린스",
  "뉴욕 양키스": "#양키스",
  "뉴욕 메츠": "#메츠",
  "보스턴 레드삭스": "#레드삭스",
  "시카고 컵스": "#컵스",
  "애틀랜타 브레이브스": "#브레이브스",
  "토론토 블루제이스": "#블루제이스",
  "텍사스 레인저스": "#레인저스",
  "시애틀 매리너스": "#매리너스",
  // NBA
  "LA 레이커스": "#레이커스",
  골든스테이트: "#워리어스",
  보스턴: "#셀틱스",
  마이애미: "#히트",
  덴버: "#너기츠",
  오클라호마시티: "#썬더",
  필라델피아: "#식서스",
  "뉴욕": "#닉스",
  // KBL
  "창원 LG": "#창원LG",
  "부산 KCC": "#KCC",
  "안양 정관장": "#정관장",
  "고양 소노": "#소노",
};

// 한국 선수 → 소속 팀 (시즌마다 갱신 필요)
// schedule.json의 팀명 표기와 일치해야 함.
const KOREAN_PLAYERS: Array<{ name: string; team: string }> = [
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

interface ScheduleEntry {
  date: string;
  sport: string;
  league: string;
  homeTeam: string;
  awayTeam: string;
  koreanCommentary: boolean | "unknown";
}

function loadKoreanCommentaryGames(today: string): ScheduleEntry[] {
  try {
    const raw = fs.readFileSync("public/schedule.json", "utf-8");
    const data = JSON.parse(raw) as { schedules: ScheduleEntry[] };
    return data.schedules.filter(
      (s) => s.date === today && s.koreanCommentary === true,
    );
  } catch {
    return [];
  }
}

function pickMainSport(games: ScheduleEntry[]): Sport | null {
  if (games.length === 0) return null;
  const counts: Record<string, number> = {};
  for (const g of games) counts[g.sport] = (counts[g.sport] ?? 0) + 1;
  const order: Sport[] = ["축구", "야구", "농구", "배구"];
  let best: Sport | null = null;
  let bestCount = -1;
  for (const sport of order) {
    const c = counts[sport] ?? 0;
    if (c > bestCount) {
      best = sport;
      bestCount = c;
    }
  }
  return bestCount > 0 ? best : null;
}

function pickMainLeague(games: ScheduleEntry[], sport: Sport): string | null {
  const inSport = games.filter((g) => g.sport === sport);
  if (inSport.length === 0) return null;
  const present = new Set(inSport.map((g) => g.league));
  for (const lg of LEAGUE_PRIORITY[sport]) {
    if (present.has(lg) && LEAGUE_HASHTAGS[lg]) return lg;
  }
  // 우선순위에 없는 리그라도 매핑 있으면 사용
  for (const lg of present) {
    if (LEAGUE_HASHTAGS[lg]) return lg;
  }
  return null;
}

function dateHash(today: string): number {
  let hash = 0;
  for (let i = 0; i < today.length; i++) {
    hash = ((hash << 5) - hash) + today.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
}

function pickMainTeam(
  games: ScheduleEntry[],
  league: string,
  today: string,
): { team: string; player?: string } | null {
  const inLeague = games.filter((g) => g.league === league);
  if (inLeague.length === 0) return null;

  // 후보 풀 수집 — 한국 선수 소속 팀 + 매핑된 빅클럽 (중복 제거)
  const candidates: { team: string; player?: string }[] = [];
  const seen = new Set<string>();

  for (const p of KOREAN_PLAYERS) {
    if (seen.has(p.team)) continue;
    if (inLeague.some((g) => g.homeTeam === p.team || g.awayTeam === p.team)) {
      candidates.push({ team: p.team, player: p.name });
      seen.add(p.team);
    }
  }

  for (const g of inLeague) {
    for (const t of [g.homeTeam, g.awayTeam]) {
      if (TEAM_HASHTAGS[t] && !seen.has(t)) {
        candidates.push({ team: t });
        seen.add(t);
      }
    }
  }

  if (candidates.length === 0) return null;

  // 날짜 해시 기반 회전 — 같은 리그가 매일 메인이어도 팀 슬롯은 매일 다른 후보로
  return candidates[dateHash(today) % candidates.length];
}

const LEAGUE_SHORT_NAME: Record<string, string> = {
  프리미어리그: "EPL",
  챔피언스리그: "챔스",
  유로파리그: "유로파",
  컨퍼런스리그: "컨퍼런스",
  분데스리가: "분데스",
  "리그 1": "리그앙",
  "잉글랜드 FA컵": "FA컵",
  "EFL 챔피언십": "EFL",
  "북중미 챔피언스컵": "북중미챔스",
  일본프로농구: "B리그",
};

function leagueShortName(league: string): string {
  return LEAGUE_SHORT_NAME[league] ?? league;
}

export interface HierarchicalTagsResult {
  tags: string[];
  mainSport: Sport | null;
  mainLeague: string | null;
  mainTeam: string | null;
  mainPlayer: string | null;
  totalGames: number;
}

/**
 * 계층적 해시태그 5개 생성:
 *   대분류(종목) + 중분류(리그) + 소분류 A(팀) + #한국어중계 + #한해설
 * 일부 슬롯이 비면 해당 항목만 빠지고 나머지로 진행.
 */
export function getHierarchicalTags(today: string): HierarchicalTagsResult {
  const games = loadKoreanCommentaryGames(today);

  // 한국어 해설 0경기 폴백
  if (games.length === 0) {
    return {
      tags: ["#스포츠", "#한국어중계", "#한해설"],
      mainSport: null,
      mainLeague: null,
      mainTeam: null,
      mainPlayer: null,
      totalGames: 0,
    };
  }

  const sport = pickMainSport(games);
  const sportTag = sport ? SPORT_HASHTAGS[sport] : undefined;

  const league = sport ? pickMainLeague(games, sport) : null;
  const leagueTag = league ? LEAGUE_HASHTAGS[league] : undefined;

  const teamPick = league ? pickMainTeam(games, league, today) : null;
  const teamTag = teamPick ? TEAM_HASHTAGS[teamPick.team] : undefined;

  const tags = [sportTag, leagueTag, teamTag, "#한국어중계", "#한해설"].filter(
    (t): t is string => Boolean(t),
  );

  return {
    tags,
    mainSport: sport,
    mainLeague: league,
    mainTeam: teamPick?.team ?? null,
    mainPlayer: teamPick?.player ?? null,
    totalGames: games.length,
  };
}

/**
 * 영상 제목/캡션 헤드라인용 하이라이트 텍스트.
 *   "손흥민 EPL 한국어 중계" / "EPL 빅매치 한국어 중계" / "오늘의 한국어 중계 편성표"
 */
export function getMainHighlight(today: string): string {
  const r = getHierarchicalTags(today);
  if (!r.mainSport || !r.mainLeague) return "오늘의 한국어 중계 편성표";

  const leagueShort = leagueShortName(r.mainLeague);
  if (r.mainPlayer) return `${r.mainPlayer} ${leagueShort} 한국어 중계`;
  return `${leagueShort} 빅매치 한국어 중계`;
}

/**
 * @deprecated 호환용. 신규 코드는 getHierarchicalTags 사용.
 */
export function getDynamicLeagueTags(today: string, max: number): string[] {
  const r = getHierarchicalTags(today);
  // 종목·리그·팀만 추리고 max 적용
  return r.tags
    .filter((t) => t !== "#한국어중계" && t !== "#한해설")
    .slice(0, max);
}

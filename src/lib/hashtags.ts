import fs from "node:fs";
import type { Schedule, ScheduleData, Sport } from "@/types/schedule";
import { KOREAN_PLAYERS, pickHeroMatch, pickHeroMatchesTop } from "./instagram";

const SPORT_EMOJI: Record<Sport, string> = {
  축구: "⚽",
  야구: "⚾",
  농구: "🏀",
  배구: "🏐",
};

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
  노팅엄: "#노팅엄",
  "노팅엄 포레스트": "#노팅엄",
  리즈: "#리즈",
  선덜랜드: "#선덜랜드",
  에버턴: "#에버턴",
  "크리스탈 팰리스": "#크리스탈팰리스",
  풀럼: "#풀럼",
  // 라리가
  바르셀로나: "#바르셀로나",
  "레알 마드리드": "#레알마드리드",
  "AT.마드리드": "#아틀레티코",
  "아틀레티코 마드리드": "#아틀레티코",
  세비야: "#세비야",
  "레알 소시에다드": "#레알소시에다드",
  "레알 베티스": "#레알베티스",
  비야레알: "#비야레알",
  발렌시아: "#발렌시아",
  지로나: "#지로나",
  마요르카: "#마요르카",
  아틀레틱: "#아틀레틱빌바오",
  셀타: "#셀타비고",
  "셀타 비고": "#셀타비고",
  // 분데스리가
  "바이에른 뮌헨": "#바이에른뮌헨",
  도르트문트: "#도르트문트",
  슈투트가르트: "#슈투트가르트",
  레버쿠젠: "#레버쿠젠",
  프랑크푸르트: "#프랑크푸르트",
  라이프치히: "#라이프치히",
  마인츠: "#마인츠",
  묀헨글라트바흐: "#글라드바흐",
  "베르더 브레멘": "#베르더브레멘",
  볼프스부르크: "#볼프스부르크",
  "우니온 베를린": "#우니온베를린",
  호펜하임: "#호펜하임",
  프라이부르크: "#프라이부르크",
  // 세리에A
  유벤투스: "#유벤투스",
  "인터 밀란": "#인터밀란",
  "AC 밀란": "#AC밀란",
  나폴리: "#나폴리",
  "AS 로마": "#AS로마",
  아탈란타: "#아탈란타",
  라치오: "#라치오",
  볼로냐: "#볼로냐",
  피오렌티나: "#피오렌티나",
  // 리그 1
  PSG: "#PSG",
  "파리 생제르망": "#PSG",
  마르세유: "#마르세유",
  모나코: "#모나코",
  리옹: "#리옹",
  릴: "#릴",
  니스: "#니스",
  랑스: "#랑스",
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

function loadKoreanCommentaryGames(today: string): Schedule[] {
  try {
    const raw = fs.readFileSync("public/schedule.json", "utf-8");
    const data = JSON.parse(raw) as ScheduleData;
    return data.schedules
      .filter((s) => s.date === today && s.koreanCommentary === true)
      .sort((a, b) => a.time.localeCompare(b.time));
  } catch {
    return [];
  }
}

function findKoreanPlayerOnTeam(team: string): string | null {
  const found = KOREAN_PLAYERS.find((p) => p.team === team);
  return found ? found.name : null;
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
 * 빅매치(hero) 양 팀 + 한국 선수 + 리그 + 종목을 해시태그로 통일.
 * 영상 첫 화면(hero)에 등장한 매치와 캡션 해시태그가 항상 일치하도록 보장.
 *
 * 출력 예 (5/12 토트넘 vs 리즈, 양민혁 소속):
 *   #양민혁 #토트넘 #리즈 #프리미어리그 #축구 #한국어중계 #한해설
 *
 * 한국어 해설 0경기인 날: 일반 폴백 태그.
 */
export function getHierarchicalTags(today: string): HierarchicalTagsResult {
  const games = loadKoreanCommentaryGames(today);

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

  const hero = pickHeroMatch(games);
  if (!hero) {
    return {
      tags: ["#스포츠", "#한국어중계", "#한해설"],
      mainSport: null,
      mainLeague: null,
      mainTeam: null,
      mainPlayer: null,
      totalGames: games.length,
    };
  }

  const sportTag = SPORT_HASHTAGS[hero.sport];
  const leagueTag = LEAGUE_HASHTAGS[hero.league];
  const homeTag = TEAM_HASHTAGS[hero.homeTeam];
  const awayTag = hero.awayTeam ? TEAM_HASHTAGS[hero.awayTeam] : undefined;

  const playerName =
    findKoreanPlayerOnTeam(hero.homeTeam) ??
    (hero.awayTeam ? findKoreanPlayerOnTeam(hero.awayTeam) : null);
  const playerTag = playerName ? `#${playerName}` : undefined;

  // 순서: specific → general (알고리즘 분류는 앞쪽 태그를 우선 참조)
  const tags = [playerTag, homeTag, awayTag, leagueTag, sportTag, "#한국어중계", "#한해설"]
    .filter((t): t is string => Boolean(t));

  return {
    tags,
    mainSport: hero.sport,
    mainLeague: hero.league,
    mainTeam: hero.homeTeam,
    mainPlayer: playerName,
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
 * 캡션/설명용 "오늘의 빅매치 N개" 라인 생성.
 * 매일 hero 매치업이 달라지므로, 본문이 날짜만 다른 박제 텍스트가 되지 않게 함.
 *
 * 예:
 *   ⚽ EPL  토트넘 vs 리즈  18:30 · 쿠팡플레이
 *   ⚾ MLB  다저스 vs 자이언츠  11:00 · 티빙
 */
export function getHeroMatchLines(today: string, max: number = 3): {
  lines: string[];
  totalGames: number;
} {
  const games = loadKoreanCommentaryGames(today);
  const totalGames = games.length;
  if (totalGames === 0) return { lines: [], totalGames: 0 };

  const heroes = pickHeroMatchesTop(games, max);
  const lines = heroes.map((m) => {
    const emoji = SPORT_EMOJI[m.sport];
    const lg = leagueShortName(m.league);
    const matchup = m.awayTeam ? `${m.homeTeam} vs ${m.awayTeam}` : m.homeTeam;
    return `${emoji} ${lg}  ${matchup}  ${m.time} · ${m.platform}`;
  });
  return { lines, totalGames };
}

/**
 * YouTube tags 필드용 평문 태그(앞에 # 없음).
 * 동적 hero 기반 태그 + 브랜드 baseline. 매일 hero가 바뀌면 태그도 바뀜.
 */
export function getPlainTags(today: string): string[] {
  const dynamic = getHierarchicalTags(today).tags.map((t) => t.replace(/^#/, ""));
  const baseline = ["한해설", "한국어해설", "한국어중계", "스포츠중계", "편성표"];
  return Array.from(new Set([...dynamic, ...baseline]));
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

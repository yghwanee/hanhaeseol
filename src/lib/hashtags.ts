import type { Sport } from "@/types/schedule";
import { KOREAN_PLAYERS, pickHeroMatch, pickHeroMatchesTop, loadKoreanMatchesAll } from "./instagram";
import { getRivalryName, isWorldCup } from "./hero-pick";

const SPORT_EMOJI: Record<Sport, string> = {
  축구: "⚽",
  야구: "⚾",
  농구: "🏀",
  배구: "🏐",
};

// 종목 mega-tag는 2026 해시태그 5개 cap에서 자리 낭비라 슬롯 구성에서 제외.
// 종목별 emoji는 캡션 매치 라인용으로 SPORT_EMOJI 유지.

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
  // MLB — 한국 팬 검색 패턴 우선
  //  · 다른 인기 팀 없는 도시: 도시명 단독 (예: 샌프란시스코, 피츠버그)
  //  · 도시명이 NBA/NFL 인기팀과 충돌: 도시명+팀명 결합 (시카고컵스, 마이애미말린스)
  "LA 다저스": "#다저스",
  "샌프란시스코 자이언츠": "#샌프란시스코",
  "탬파베이 레이스": "#탬파베이",
  "샌디에이고 파드리스": "#파드리스",
  "피츠버그 파이리츠": "#피츠버그",
  "마이애미 말린스": "#마이애미말린스",
  "뉴욕 양키스": "#양키스",
  "뉴욕 메츠": "#메츠",
  "보스턴 레드삭스": "#레드삭스",
  "시카고 컵스": "#시카고컵스",
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

/**
 * 월드컵 국가명 → 해시태그. "남아프리카 공화국" → "#남아프리카공화국".
 * 조 미정(TBD) "미정" 등 국가가 아닌 값은 null.
 */
function countryHashtag(name: string): string | null {
  if (!name || name === "미정") return null;
  return `#${name.replace(/\s+/g, "")}`;
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
  "북중미 월드컵": "월드컵",
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
 * 인스타 해시태그 5개 슬롯 — 2025/12 이후 5개 hard cap 대응.
 *
 * 슬롯:
 *   1. 한국 선수 (없으면 라이벌리 별명; 둘 다 없으면 폴백으로 #스포츠편성표)
 *   2. 홈팀 (TEAM_HASHTAGS 매핑)
 *   3. 원정팀 (TEAM_HASHTAGS 매핑)
 *   4. 리그 (LEAGUE_HASHTAGS 매핑)
 *   5. #한국어중계 (고정 brand-keyword)
 *
 * 출력 예:
 *   한국 선수 매치:     #이정후 #샌프란시스코 #다이아몬드백스 #MLB #한국어중계
 *   라이벌리 매치:      #엘클라시코 #레알마드리드 #바르셀로나 #라리가 #한국어중계
 *   일반 매치:          #풀럼 #본머스 #프리미어리그 #한국어중계 #스포츠편성표
 *
 * 한국어 해설 0경기인 날: 폴백 2개만 (#한국어중계 #스포츠편성표).
 */
export function getHierarchicalTags(today: string): HierarchicalTagsResult {
  const games = loadKoreanMatchesAll(today);

  const FALLBACK_EMPTY: HierarchicalTagsResult = {
    tags: ["#한국어중계", "#스포츠편성표"],
    mainSport: null,
    mainLeague: null,
    mainTeam: null,
    mainPlayer: null,
    totalGames: games.length,
  };

  if (games.length === 0) return { ...FALLBACK_EMPTY, totalGames: 0 };

  const hero = pickHeroMatch(games);
  if (!hero) return FALLBACK_EMPTY;

  // 월드컵 히어로: 국가팀·"북중미 월드컵"은 일반 리그/팀 해시태그 매핑이 없으므로
  // 월드컵 전용 슬롯으로 구성. 대한민국 경기면 #대한민국 최우선. (월드컵 기간에만 진입)
  if (isWorldCup(hero)) {
    const koreaHome = hero.homeTeam === "대한민국";
    const koreaAway = hero.awayTeam === "대한민국";
    const wcTags: string[] = [];
    if (koreaHome || koreaAway) {
      wcTags.push("#대한민국", "#월드컵");
      const oppTag = countryHashtag(koreaHome ? (hero.awayTeam ?? "") : hero.homeTeam);
      if (oppTag) wcTags.push(oppTag);
    } else {
      wcTags.push("#월드컵");
      const homeC = countryHashtag(hero.homeTeam);
      const awayC = hero.awayTeam ? countryHashtag(hero.awayTeam) : null;
      if (homeC) wcTags.push(homeC);
      if (awayC) wcTags.push(awayC);
    }
    wcTags.push("#2026월드컵", "#한국어중계");
    const capped = Array.from(new Set(wcTags)).slice(0, 5);
    return {
      tags: capped,
      mainSport: hero.sport,
      mainLeague: hero.league,
      mainTeam: hero.homeTeam,
      mainPlayer: null,
      totalGames: games.length,
    };
  }

  const leagueTag = LEAGUE_HASHTAGS[hero.league];
  const homeTag = TEAM_HASHTAGS[hero.homeTeam];
  const awayTag = hero.awayTeam ? TEAM_HASHTAGS[hero.awayTeam] : undefined;

  const playerName =
    findKoreanPlayerOnTeam(hero.homeTeam) ??
    (hero.awayTeam ? findKoreanPlayerOnTeam(hero.awayTeam) : null);
  const playerTag = playerName ? `#${playerName}` : undefined;

  // Slot 1: 한국 선수 우선, 없으면 라이벌리명
  const slot1 = playerTag ?? getRivalryName(hero.homeTeam, hero.awayTeam);

  const tags: string[] = [];
  if (slot1) tags.push(slot1);
  if (homeTag) tags.push(homeTag);
  if (awayTag) tags.push(awayTag);
  if (leagueTag) tags.push(leagueTag);
  if (!tags.includes("#한국어중계")) tags.push("#한국어중계");

  // 5개 안 차면 #스포츠편성표로 폴백
  if (tags.length < 5 && !tags.includes("#스포츠편성표")) {
    tags.push("#스포츠편성표");
  }

  // 최종 5개 cap (인스타 2025/12 정책)
  const capped = tags.slice(0, 5);

  return {
    tags: capped,
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
  // 월드컵 히어로면 매치업 기반 월드컵 제목 (대한민국 경기는 🇰🇷 강조). 월드컵 기간에만 진입.
  const games = loadKoreanMatchesAll(today);
  const wcHero = games.length ? pickHeroMatch(games) : null;
  if (wcHero && isWorldCup(wcHero)) {
    const emoji = SPORT_EMOJI[wcHero.sport];
    const korea = wcHero.homeTeam === "대한민국" || wcHero.awayTeam === "대한민국";
    // 녹아웃 대진 미확정("미정")은 매치업에서 제외 → 둘 다 미정이면 매치업 없는 일반 월드컵 제목.
    const home = wcHero.homeTeam !== "미정" ? wcHero.homeTeam : null;
    const away = wcHero.awayTeam && wcHero.awayTeam !== "미정" ? wcHero.awayTeam : null;
    const matchup = home && away ? `${home} vs ${away}` : home || away || "";
    return matchup
      ? `${korea ? "🇰🇷 " : ""}월드컵 ${matchup} 한국어 중계 ${emoji}`
      : `월드컵 한국어 중계 ${emoji}`;
  }

  const r = getHierarchicalTags(today);
  if (!r.mainSport || !r.mainLeague) return "한국어 중계 편성표";

  const leagueShort = leagueShortName(r.mainLeague);
  const emoji = SPORT_EMOJI[r.mainSport];
  if (r.mainPlayer) return `${r.mainPlayer} ${leagueShort} 한국어 중계 ${emoji}`;
  return `${leagueShort} 빅매치 한국어 중계 ${emoji}`;
}

/**
 * 캡션/설명의 "🎯 …의 빅매치" 섹션 라벨용 단어.
 * 히어로가 월드컵이면 "월드컵", 아니면 "빅매치". (제목/해시태그와 동일 히어로 기준)
 */
export function getHeroEventWord(today: string): "월드컵" | "빅매치" {
  const games = loadKoreanMatchesAll(today);
  const hero = games.length ? pickHeroMatch(games) : null;
  return hero && isWorldCup(hero) ? "월드컵" : "빅매치";
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
  const games = loadKoreanMatchesAll(today);
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
  // YouTube tags 필드(보이지 않는 검색용 키워드)는 인스타 5개 cap과 별개.
  // dynamic(매치별 5개) + baseline(검색 키워드)을 합쳐 검색 매칭 폭 넓힘.
  // baseline에서 "한해설"은 검색 트래픽 0이라 제외.
  const dynamic = getHierarchicalTags(today).tags.map((t) => t.replace(/^#/, ""));
  const baseline = ["한국어해설", "한국어중계", "스포츠중계", "스포츠편성표", "Shorts"];
  return Array.from(new Set([...dynamic, ...baseline]));
}

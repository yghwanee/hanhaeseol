import { Sport } from "@/types/schedule";

const LEAGUE_SPORT_MAP: Record<string, Sport> = {
  // 축구
  EPL: "축구", "프리미어리그": "축구", "라리가": "축구", "세리에A": "축구",
  "분데스리가": "축구", "리그앙": "축구", "리그1": "축구",
  "K리그": "축구", "K리그1": "축구", "K리그2": "축구",
  UCL: "축구", "챔피언스리그": "축구", "유로파리그": "축구",
  "FA컵": "축구", "코파델레이": "축구", "DFB포칼": "축구",
  "AFC": "축구", "A매치": "축구",
  MLS: "축구", "J리그": "축구", "에레디비시": "축구",
  // 야구
  KBO: "야구", MLB: "야구", NPB: "야구",
  "퓨처스리그": "야구", "스프링캠프": "야구", "메이저리그": "야구",
  // 농구
  NBA: "농구", KBL: "농구", "프로농구": "농구", WNBA: "농구",
  // 배구
  "V리그": "배구", "프로배구": "배구",
};

export function detectSport(text: string): Sport | null {
  for (const [keyword, sport] of Object.entries(LEAGUE_SPORT_MAP)) {
    if (text.includes(keyword)) return sport;
  }
  return null;
}

const NON_MATCH_KEYWORDS = [
  "하이라이트", "시상식", "스포타임", "골모음", "랭킹쇼",
  "스페셜", "다시보기", "명장면", "프리뷰", "리뷰",
  "BEST", "베스트", "주간", "명승부",
];

export function isActualMatch(title: string): boolean {
  return !NON_MATCH_KEYWORDS.some((kw) => title.includes(kw));
}

const DOMESTIC_LEAGUE_KEYWORDS = [
  "KBO", "K리그", "K리그1", "K리그2", "프로농구", "KBL",
  "V리그", "프로배구", "퓨처스리그",
];

export function detectKoreanCommentary(text: string): boolean | "unknown" {
  if (/한국어\s?해설/.test(text)) return true;
  if (/현지\s?해설|현지음|원어/.test(text)) return false;
  if (DOMESTIC_LEAGUE_KEYWORDS.some((kw) => text.includes(kw))) return true;
  return "unknown";
}

// 리그명 정규화: "2025-2026 LG전자 프로농구" → "프로농구"
const LEAGUE_NORMALIZE: [RegExp, string][] = [
  [/프로농구/, "프로농구"],
  [/여자프로농구/, "여자프로농구"],
  [/일본\s?프로농구/, "일본프로농구"],
  [/KBO/, "KBO"],
  [/메이저리그/, "MLB"],
  [/MLB/, "MLB"],
  [/프로배구/, "프로배구"],
  [/V리그/, "V리그"],
  [/K리그2/, "K리그2"],
  [/K리그1?(?!2)/, "K리그"],
  [/고교야구/, "고교야구"],
  [/AFC\s+U-\d+\s+여자\s+아시안컵/, "AFC U-20 여자 아시안컵"],
  [/AFC\s+U-\d+\s+아시안컵/, "AFC U-20 아시안컵"],
  [/AFC\s+챔피언스리그|ACL/, "ACL"],
];

export function normalizeLeague(raw: string): string {
  for (const [pattern, name] of LEAGUE_NORMALIZE) {
    if (pattern.test(raw)) return name;
  }
  // 연도/시즌 접두사 제거: "25-26", "2026" 등
  return raw.replace(/^\d{2,4}[-\s]?\d{0,2}\s*/, "").trim() || raw;
}

// "[EPL] 맨체스터 시티 vs 아스널" 같은 제목 파싱
export function parseMatchTitle(title: string): {
  league: string;
  homeTeam: string;
  awayTeam: string;
  sport: Sport | null;
} {
  // 대괄호 선수명/태그 제거: [손흥민], [이정후 오늘 경기] 등
  const cleaned = title.replace(/\[.*?\]\s*/g, "").trim();

  // 팀명 정리: "삼성_4/6 19:00" → "삼성"
  const cleanTeam = (name: string) =>
    name.replace(/[_]\d+\/\d+.*$/, "").replace(/\(.+?\)/g, "").replace(/[,、].*$/, "").trim();

  // 패턴1: [리그] 홈 vs 원정
  const bracketMatch = title.match(/\[(.+?)\]\s*(.+?)\s*(?:vs|VS|v)\s*(.+)/);
  if (bracketMatch) {
    const league = bracketMatch[1].trim();
    return {
      league: normalizeLeague(league),
      homeTeam: cleanTeam(bracketMatch[2]),
      awayTeam: cleanTeam(bracketMatch[3]),
      sport: detectSport(league),
    };
  }

  // 패턴2: 홈 vs 원정
  const vsMatch = cleaned.match(/(.+?)\s*(?:vs|VS|v)\s*(.+)/);
  if (vsMatch) {
    const home = vsMatch[1].trim();
    const away = cleanTeam(vsMatch[2]);
    // "KBO리그 한화" → league="KBO", home="한화"
    const leagueInHome = home.match(/^(.+?리그\d?|NBA|MLB|MLS|KBO|NPB)\s+(.+)$/);
    if (leagueInHome) {
      return {
        league: normalizeLeague(leagueInHome[1]),
        homeTeam: leagueInHome[2].trim(),
        awayTeam: away,
        sport: detectSport(title),
      };
    }
    // "여자프로농구 플레이오프 3차전 우리은행" → league="여자프로농구", home="우리은행"
    const prefixMatch = home.match(/^(.*?프로농구|.*?프로배구)\s+(?:.*?전\s+)?(.+)$/);
    if (prefixMatch) {
      return {
        league: normalizeLeague(prefixMatch[1]),
        homeTeam: prefixMatch[2].trim(),
        awayTeam: away,
        sport: detectSport(title),
      };
    }
    return {
      league: normalizeLeague(title),
      homeTeam: home,
      awayTeam: away,
      sport: detectSport(title),
    };
  }

  // 패턴3: "리그명 홈팀:원정팀" (SPOTV TV 스타일)
  const colonMatch = cleaned.match(/^(.+?)\s+(.+?)\s*[:]\s*(.+?)(?:\s*\(.*\))?$/);
  if (colonMatch) {
    const league = colonMatch[1].trim();
    const home = colonMatch[2].trim();
    const away = cleanTeam(colonMatch[3]);
    // "2026" + "KBO리그 한화" → league="KBO", home="한화"
    const fullText = `${league} ${home}`;
    const leagueInHome = fullText.match(/^.*?(KBO리그\d?|K리그\d?|MLB|MLS|NBA|NPB|메이저리그|프로농구|여자프로농구|프로배구|V리그|신한\s*SOL\s*KBO리그|AFC\s+[\w\-]+(?:\s+여자)?\s+아시안컵|AFC\s+챔피언스리그|ACL)\s+(.+)$/);
    if (leagueInHome) {
      return {
        league: normalizeLeague(leagueInHome[1]),
        homeTeam: leagueInHome[2].trim(),
        awayTeam: away,
        sport: detectSport(fullText) ?? detectSport(title),
      };
    }
    return {
      league: normalizeLeague(league),
      homeTeam: home,
      awayTeam: away,
      sport: detectSport(league) ?? detectSport(title),
    };
  }

  // 파싱 실패
  return {
    league: normalizeLeague(title),
    homeTeam: cleaned,
    awayTeam: "",
    sport: detectSport(title),
  };
}

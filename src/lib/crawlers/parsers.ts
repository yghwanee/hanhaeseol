import { Sport } from "@/types/schedule";

const HTML_ENTITIES: Record<string, string> = {
  "&amp;": "&", "&lt;": "<", "&gt;": ">",
  "&quot;": '"', "&#39;": "'", "&apos;": "'",
};

export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(?:amp|lt|gt|quot|#39|apos);/g, (m) => HTML_ENTITIES[m] || m);
}

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
  "퓨처스리그": "야구", "스프링캠프": "야구", "메이저리그": "야구", "고교야구": "야구",
  // 농구
  NBA: "농구", KBL: "농구", "프로농구": "농구", WNBA: "농구",
  // 배구
  "V리그": "배구", "V-리그": "배구", "프로배구": "배구",
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
  "BEST", "베스트", "주간", "명승부", "UFC",
];

export function isActualMatch(title: string): boolean {
  return !NON_MATCH_KEYWORDS.some((kw) => title.includes(kw));
}

const DOMESTIC_LEAGUE_KEYWORDS = [
  "KBO", "K리그", "K리그1", "K리그2", "프로농구", "KBL",
  "V리그", "프로배구", "퓨처스리그", "고교야구",
];

export function detectKoreanCommentary(text: string): boolean | "unknown" {
  if (/한국어\s?해설/.test(text)) return true;
  if (/현지\s?해설|현지음|원어/.test(text)) return false;
  if (DOMESTIC_LEAGUE_KEYWORDS.some((kw) => text.includes(kw))) return true;
  return "unknown";
}

// 리그명 정규화: "2025-2026 LG전자 프로농구" → "프로농구"
const LEAGUE_NORMALIZE: [RegExp, string][] = [
  [/여자\s?프로농구|WKBL/, "WKBL"],
  [/일본\s?프로농구/, "일본프로농구"],
  [/프로농구/, "프로농구"],
  [/퓨처스리그/, "퓨처스리그"],
  [/KBO/, "KBO"],
  [/메이저리그/, "MLB"],
  [/MLB/, "MLB"],
  [/프로배구/, "프로배구"],
  [/V-?리그/, "V리그"],
  [/K리그2/, "K리그2"],
  [/K리그1?(?!2)/, "K리그"],
  [/고교야구/, "고교야구"],
  [/AFC\s+U-?\d+\s+여자\s+아시안컵/, "AFC U-20 여자 아시안컵"],
  [/AFC\s+U-?\d+\s+아시안컵/, "AFC U-20 아시안컵"],
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
  // 꺾쇠 대회 부가정보 제거: <2026 신세계 이마트배 8강> 등
  // "시리즈" 등 불필요 수식어 제거
  const cleaned = title
    .replace(/\[.*?\]\s*/g, "")
    .replace(/<[^>]*>\s*/g, "")
    .replace(/시리즈\s*/g, "")
    .replace(/^.+?종료\s*후\s*/g, "")
    .trim();

  // 팀명 정리: "삼성_4/6 19:00" → "삼성", "8강전 대한민국" → "대한민국"
  const cleanTeam = (name: string) =>
    name.replace(/[_]\d+\/\d+.*$/, "").replace(/\(.+?\)/g, "").replace(/[,、].*$/, "")
      .replace(/^(?:8강전|4강전|준결승전?|결승전?|조별리그|조별예선|16강전?|32강전?|3[·.]?4위전?)\s*/g, "")
      .trim();

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
    const prefixMatch = home.match(/^(.*?프로농구|.*?프로배구)\s+(?:플레이오프\s*)?(?:.*?전[,\s]+)?(.+)$/);
    if (prefixMatch) {
      return {
        league: normalizeLeague(prefixMatch[1]),
        homeTeam: prefixMatch[2].trim(),
        awayTeam: away,
        sport: detectSport(title),
      };
    }
    const league = normalizeLeague(title);
    // 리그명을 homeTeam에서 제거: "2026 AFC U-20 여자 아시안컵 8강전 대한민국" → "대한민국"
    let homeClean = home;
    const leagueIdx = homeClean.indexOf(league);
    if (leagueIdx >= 0) {
      homeClean = homeClean.slice(leagueIdx + league.length).trim();
    } else {
      // 정규화 전 원본 패턴으로 재탐색 (예: "U20" vs 정규화된 "U-20" 불일치)
      for (const [pattern] of LEAGUE_NORMALIZE) {
        const m = homeClean.match(pattern);
        if (m && m.index !== undefined) {
          homeClean = homeClean.slice(m.index + m[0].length).trim();
          break;
        }
      }
    }
    // 단계명 + 쉼표 + 팀명 형태 처리: "결승, 일본" → "일본"
    const stageCommaMatch = homeClean.match(
      /^(?:결승전?|준결승전?|8강전?|4강전?|16강전?|32강전?|조별리그|조별예선|3[·.]?4위전?)[,\s]+(.+)$/,
    );
    if (stageCommaMatch) {
      homeClean = stageCommaMatch[1];
    }
    return {
      league,
      homeTeam: cleanTeam(homeClean),
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
    const leagueInHome = fullText.match(/^.*?(퓨처스리그|KBO리그\d?|K리그\d?|MLB|MLS|NBA|NPB|메이저리그|프로농구|여자프로농구|프로배구|V-?리그|신한\s*SOL\s*KBO리그|AFC\s+[\w\-]+(?:\s+여자)?\s+아시안컵|AFC\s+챔피언스리그|ACL|고교야구)\s+(.+)$/);
    if (leagueInHome) {
      const homeRaw = cleanTeam(leagueInHome[2].trim()
        .replace(/^(?:포스트시즌\s*)?(?:남자부\s*|여자부\s*)?(?:챔피언결정전\s*)?(?:플레이오프\s*)?(?:\d+차전\s*)?(?:\d+차\s*)?/, "").trim());
      return {
        league: normalizeLeague(leagueInHome[1]),
        homeTeam: homeRaw,
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

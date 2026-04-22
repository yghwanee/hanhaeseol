import { Schedule, Sport } from "@/types/schedule";
import { normalizeLeague } from "./parsers";
import { toKstDateTime } from "./_utils";

interface AppleTvCompetitor {
  name: string;
  abbreviation: string;
  isHome: boolean;
}

interface AppleTvPlayable {
  locales?: { displayName: string; locale: string }[];
}

interface AppleTvItem {
  title: string;
  sportName: string;
  leagueName: string;
  airingType: string;
  competitors: AppleTvCompetitor[];
  playables?: AppleTvPlayable[];
  eventTime?: {
    gameKickOffStartTime?: number;
  };
}

const SPORT_MAP: Record<string, Sport> = {
  "야구": "야구",
  "축구": "축구",
  "농구": "농구",
  "배구": "배구",
};

async function getTokenAndUtsk(): Promise<{ token: string; utsk: string } | null> {
  const res = await fetch("https://tv.apple.com/kr", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;
  const html = await res.text();

  const tokenMatch = html.match(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/);
  const utskMatch = html.match(/utsk["=:]+([^"&]+)/);

  if (!tokenMatch || !utskMatch) return null;
  return { token: tokenMatch[0], utsk: utskMatch[1] };
}

export async function crawlAppleTv(date: string): Promise<Schedule[]> {
  const auth = await getTokenAndUtsk();
  if (!auth) {
    console.error("Apple TV+: 토큰 추출 실패");
    return [];
  }

  const apiUrl = `https://tv.apple.com/api/uts/v3/shelves/uts.col.apple-sports?caller=web&pfm=web&locale=ko-KR&sf=143466&v=94&utsk=${auth.utsk}`;

  const res = await fetch(apiUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0",
      "Authorization": `Bearer ${auth.token}`,
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`Apple TV+: HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: AppleTvItem[] = data?.data?.shelf?.items || [];
  const schedules: Schedule[] = [];

  for (const item of items) {
    const kickoff = item.eventTime?.gameKickOffStartTime;
    if (!kickoff) continue;

    const { date: itemDate, time } = toKstDateTime(kickoff);

    // 요청한 날짜만 필터
    if (itemDate !== date) continue;

    const sport = SPORT_MAP[item.sportName];
    if (!sport) continue;

    const home = item.competitors.find((c) => c.isHome);
    const away = item.competitors.find((c) => !c.isHome);

    // 한국어 해설 여부: locales에 한국어가 있는지 확인
    const locales = item.playables?.[0]?.locales?.map((l) => l.locale) || [];
    const hasKorean = locales.some((l) => l.startsWith("ko"));

    schedules.push({
      id: `apple-tv-${date}-${time}-${item.leagueName}-${away?.abbreviation ?? ""}-${home?.abbreviation ?? ""}`,
      date,
      time,
      sport,
      league: normalizeLeague(item.leagueName),
      homeTeam: home?.name ?? "",
      awayTeam: away?.name ?? "",
      platform: "Apple TV+",
      koreanCommentary: hasKorean ? true : false,
    });
  }

  return schedules;
}

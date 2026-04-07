import { Schedule } from "@/types/schedule";
import { parseMatchTitle, detectKoreanCommentary, isActualMatch } from "./parsers";

interface TvnScheduleItem {
  scheDt: string;       // "20260406"
  bdStrTtm: string;     // "03:00"
  pgmNm: string;        // 프로그램명
  pgmEpinoNm: string;   // 회차/경기정보
  bdFgNm: string;       // "본" | "재"
}

export async function crawlTvnSports(date: string): Promise<Schedule[]> {
  const url = "https://tvnsports.cjenm.com/ko/tvnsports/schedule/";

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`tvN SPORTS: HTTP ${res.status}`);
    return [];
  }

  const html = await res.text();

  // "schePgmList":[...] 패턴으로 JSON 배열 추출
  let items: TvnScheduleItem[] = [];

  const match = html.match(/"schePgmList"\s*:\s*(\[[\s\S]*?\])(?=\s*[,}])/);
  if (match) {
    try {
      items = JSON.parse(match[1]);
    } catch {
      console.error("tvN SPORTS: Failed to parse schePgmList JSON");
    }
  }

  if (items.length === 0) {
    console.error("tvN SPORTS: schePgmList not found");
    return [];
  }

  const dateCompact = date.replace(/-/g, "");
  const schedules: Schedule[] = [];

  for (const item of items) {
    if (item.scheDt !== dateCompact) continue;
    if (item.bdFgNm === "재") continue;
    const fullTitle = `${item.pgmNm} ${item.pgmEpinoNm ?? ""}`.trim();
    if (!isActualMatch(fullTitle)) continue;

    const time = item.bdStrTtm;
    const parsed = parseMatchTitle(fullTitle);
    const commentary = detectKoreanCommentary(fullTitle);

    schedules.push({
      id: `tvn-${date}-${time}-${item.pgmNm.slice(0, 20)}`,
      date,
      time,
      sport: parsed.sport ?? "축구",
      league: parsed.league,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      platform: "tvN SPORTS",
      koreanCommentary: commentary,
    });
  }

  return schedules;
}

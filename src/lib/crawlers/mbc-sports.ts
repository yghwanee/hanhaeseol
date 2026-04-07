import { Schedule } from "@/types/schedule";
import { parseMatchTitle, detectKoreanCommentary, isActualMatch } from "./parsers";

interface MbcScheduleItem {
  frhms: string;       // "143000" (시작시간 HHMMSS)
  pgmName: string;     // 프로그램명
  pgmTitle: string;    // 부제목
  broadType: string;   // "Y"=본방, "N"=재방
  liveYn: string;      // "Y"=생방송
  realYmd: string;     // "20260406"
}

export async function crawlMbcSports(date: string): Promise<Schedule[]> {
  const dateCompact = date.replace(/-/g, "");
  const url = "https://www.mbcplus.com/web/schedule/jsonList.do";

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "User-Agent": "Mozilla/5.0",
    },
    body: `brdYmd=${dateCompact}&categoryid=5&channelSeq=2`,
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`MBC SPORTS+: HTTP ${res.status}`);
    return [];
  }

  const data = await res.json();
  const items: MbcScheduleItem[] = data.resultList ?? [];
  const schedules: Schedule[] = [];

  for (const item of items) {
    // 본방 또는 생방송만, 비경기 콘텐츠 제외
    if (item.broadType !== "Y" && item.liveYn !== "Y") continue;
    const fullTitle = `${item.pgmName} ${item.pgmTitle ?? ""}`.trim();
    if (!isActualMatch(fullTitle)) continue;

    const hh = item.frhms.slice(0, 2);
    const mm = item.frhms.slice(2, 4);
    const time = `${hh}:${mm}`;

    const parsed = parseMatchTitle(fullTitle);
    const commentary = detectKoreanCommentary(fullTitle);

    schedules.push({
      id: `mbc-${date}-${time}-${item.pgmName.slice(0, 20)}`,
      date,
      time,
      sport: parsed.sport ?? "축구",
      league: parsed.league,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      platform: "MBC SPORTS+",
      koreanCommentary: commentary,
    });
  }

  return schedules;
}

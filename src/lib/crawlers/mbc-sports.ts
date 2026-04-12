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
    // 생방송만 수집 (녹화 본방송 제외)
    if (item.liveYn !== "Y") continue;
    // pgmTitle: "1차전,KB스타즈 : 우리은행" → "KB스타즈 vs 우리은행"
    const subtitle = (item.pgmTitle ?? "")
      .replace(/^\d+차전[,\s]*/g, "")
      .replace(/\s*:\s*/g, " vs ");
    const fullTitle = `${item.pgmName} ${subtitle}`.trim();
    if (!isActualMatch(fullTitle)) continue;

    const hh = item.frhms.slice(0, 2);
    const mm = item.frhms.slice(2, 4);
    const time = `${hh}:${mm}`;

    const parsed = parseMatchTitle(fullTitle);
    if (!parsed.sport) continue;
    const commentary = detectKoreanCommentary(fullTitle);

    schedules.push({
      id: `mbc-${date}-${time}-${item.pgmName.slice(0, 20)}`,
      date,
      time,
      sport: parsed.sport,
      league: parsed.league,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      platform: "MBC SPORTS+",
      koreanCommentary: commentary,
    });
  }

  return schedules;
}

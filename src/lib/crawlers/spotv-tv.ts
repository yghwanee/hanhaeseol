import { Schedule, Platform } from "@/types/schedule";
import { parseMatchTitle, detectKoreanCommentary, isActualMatch, decodeHtmlEntities } from "./parsers";

interface SpotvTvItem {
  kind: string;       // "LIVE", "본방송", "재방송"
  sch_date: string;   // "2026-04-06"
  sch_hour: number;   // 21
  sch_min: string;    // "30"
  title: string;
}

async function fetchChannel(channel: "SPOTV" | "SPOTV2", date: string): Promise<Schedule[]> {
  const dateCompact = date.replace(/-/g, "");
  const url = `https://www.spotv.net/data/json/schedule/${channel}/Daily/D${dateCompact}.json`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`${channel}: HTTP ${res.status}`);
    return [];
  }

  const items: SpotvTvItem[] = await res.json();
  const schedules: Schedule[] = [];

  for (const item of items) {
    // LIVE만 (본방송은 녹화중계 포함이라 제외)
    if (item.kind !== "LIVE") continue;
    const title = decodeHtmlEntities(item.title);
    if (!isActualMatch(title)) continue;

    const time = `${String(item.sch_hour).padStart(2, "0")}:${item.sch_min.padStart(2, "0")}`;
    const parsed = parseMatchTitle(title);
    if (!parsed.sport) continue;
    const commentary = detectKoreanCommentary(title);

    schedules.push({
      id: `${channel.toLowerCase()}-${date}-${time}-${title.slice(0, 20)}`,
      date,
      time,
      sport: parsed.sport,
      league: parsed.league,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      platform: channel as Platform,
      koreanCommentary: commentary,
    });
  }

  return schedules;
}

export async function crawlSpotvTv(date: string): Promise<Schedule[]> {
  const [spotv, spotv2] = await Promise.allSettled([
    fetchChannel("SPOTV", date),
    fetchChannel("SPOTV2", date),
  ]);

  return [
    ...(spotv.status === "fulfilled" ? spotv.value : []),
    ...(spotv2.status === "fulfilled" ? spotv2.value : []),
  ];
}

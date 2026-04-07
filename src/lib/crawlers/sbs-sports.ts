import { Schedule } from "@/types/schedule";
import { parseMatchTitle, detectKoreanCommentary, isActualMatch } from "./parsers";

interface SbsScheduleItem {
  start_time: string;   // "18:20" (24시 초과 가능, e.g. "26:00" = 다음날 02:00)
  end_time: string;
  title: string;        // "2026 KBO리그 LG:NC"
  live_flag: string;    // "1" = 생중계, "0" = 녹화/재방
  onair_flag: string;   // "1" = 현재 방송 중
}

export async function crawlSbsSports(date: string): Promise<Schedule[]> {
  const [year, month, day] = date.split("-");
  // SBS API는 월/일에 leading zero 없이 사용
  const url = `https://static.cloud.sbs.co.kr/schedule/${year}/${Number(month)}/${Number(day)}/ESPN.json`;

  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`SBS Sports: HTTP ${res.status}`);
    return [];
  }

  const items: SbsScheduleItem[] = await res.json();
  const schedules: Schedule[] = [];

  for (const item of items) {
    // 생중계만 수집
    if (item.live_flag !== "1") continue;
    if (!isActualMatch(item.title)) continue;

    // 24시 초과 시간 처리 (e.g. "26:00" → 다음날이므로 스킵)
    const [hh, mm] = item.start_time.split(":").map(Number);
    if (hh >= 24) continue;

    const time = `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
    const parsed = parseMatchTitle(item.title);
    const commentary = detectKoreanCommentary(item.title);

    schedules.push({
      id: `sbs-sports-${date}-${time}-${item.title.slice(0, 20)}`,
      date,
      time,
      sport: parsed.sport ?? "축구",
      league: parsed.league,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      platform: "SBS Sports",
      // SBS Sports는 국내 채널이므로 기본 한국어 해설
      koreanCommentary: commentary === "unknown" ? true : commentary,
    });
  }

  return schedules;
}

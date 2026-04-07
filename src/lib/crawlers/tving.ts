import { Schedule } from "@/types/schedule";
import { parseMatchTitle, detectKoreanCommentary, isActualMatch } from "./parsers";

const TVING_API_KEY = "1e7952d0917d6aab1f0293a063697610";
const TVING_CHANNEL = "C51404"; // tvN SPORTS

// 주의: 이 크롤러는 티빙 tvN SPORTS 채널의 편성표만 수집합니다.
// 기존 tvn-sports.ts 크롤러는 tvN SPORTS 공식 사이트에서 크롤링하므로 별도 유지합니다.
// 이 크롤러는 티빙 OTT 플랫폼 자체 편성(KBO 등)이 추가될 때를 대비한 것입니다.

interface TvingSchedule {
  broadcast_start_time: number; // YYYYMMDDHHmmss
  broadcast_end_time: number;
  program?: { name?: { ko?: string }; category_code?: string };
  episode?: { name?: { ko?: string } };
}

export async function crawlTving(date: string): Promise<Schedule[]> {
  const dateCompact = date.replace(/-/g, "");

  // 3시간 블록 8개로 하루 전체 조회
  const blocks = [
    ["000000", "025959"], ["030000", "055959"], ["060000", "085959"], ["090000", "115959"],
    ["120000", "145959"], ["150000", "175959"], ["180000", "205959"], ["210000", "235959"],
  ];

  const allSchedules: TvingSchedule[] = [];

  for (const [start, end] of blocks) {
    const url = `https://api.tving.com/v1/media/schedules?pageNo=1&pageSize=20&order=chno&scope=all&adult=n&free=all&broadDate=${dateCompact}&broadcastDate=${dateCompact}&startBroadTime=${start}&endBroadTime=${end}&channelCode=${TVING_CHANNEL}&screenCode=CSSD0100&networkCode=CSND0900&osCode=CSOD0900&teleCode=CSCD0900&apiKey=${TVING_API_KEY}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const items = data?.body?.result || [];
      for (const item of items) {
        const scheds: TvingSchedule[] = item.schedules || [];
        allSchedules.push(...scheds);
      }
    } catch {
      continue;
    }
  }

  const schedules: Schedule[] = [];

  for (const s of allSchedules) {
    const pgmName = s.program?.name?.ko || "";
    const epName = s.episode?.name?.ko || "";
    const title = epName || pgmName;

    if (!isActualMatch(title)) continue;

    const st = String(s.broadcast_start_time);
    const time = `${st.substring(8, 10)}:${st.substring(10, 12)}`;

    const parsed = parseMatchTitle(title);
    if (!parsed.sport) continue;

    const commentary = detectKoreanCommentary(title);

    schedules.push({
      id: `tving-${date}-${time}-${title.slice(0, 20)}`,
      date,
      time,
      sport: parsed.sport,
      league: parsed.league,
      homeTeam: parsed.homeTeam,
      awayTeam: parsed.awayTeam,
      platform: "티빙",
      koreanCommentary: commentary === "unknown" ? true : commentary,
    });
  }

  return schedules;
}

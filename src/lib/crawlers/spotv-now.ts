import { Schedule } from "@/types/schedule";
import { normalizeLeague } from "./parsers";

interface SpotvNowGame {
  beginDate: string;
  id: number;
  gameDesc: {
    typeName: string;
    leagueNameFull: string;
    leagueName: string;
    homeName: string;
    awayName: string;
    beginDate: string;
  };
  lives: {
    id: number;
    language: number;
    isFree: boolean;
    status: number;
    title: string;
  }[];
}

const SPORT_MAP: Record<string, Schedule["sport"]> = {
  "축구": "축구", "야구": "야구", "농구": "농구", "배구": "배구",
};

function languageToCommentary(lang: number): boolean | "unknown" {
  if (lang === 2) return true;
  if (lang === 3) return false;
  return "unknown";
}

export async function crawlSpotvNow(date: string): Promise<Schedule[]> {
  const url = `https://www.spotvnow.co.kr/api/v3/schedule?date=${date}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) {
    console.error(`SPOTV NOW: HTTP ${res.status}`);
    return [];
  }

  const games: SpotvNowGame[] = await res.json();
  const schedules: Schedule[] = [];

  for (const game of games) {
    const desc = game.gameDesc;
    if (!desc) continue;

    // 🔴 종합대회는 필드가 뒤집혀 온다(2026-09-14 실측, 아이치·나고야 아시안게임):
    //   typeName = "아이치·나고야 아시안게임", leagueName = "축구" | "배구" | "농구"
    // typeName 만 보면 전부 버려진다. 그땐 leagueName 이 종목이고 typeName 이 대회명이다.
    const multiEvent = !SPORT_MAP[desc.typeName] && !!SPORT_MAP[desc.leagueName];
    const sport = SPORT_MAP[desc.typeName] ?? SPORT_MAP[desc.leagueName];
    if (!sport) continue;
    const leagueName = multiEvent ? desc.typeName : normalizeLeague(desc.leagueNameFull || desc.leagueName);

    // SPOTV NOW API는 야구에서 homeName/awayName이 한국 방송 '원정:홈' 관례로 뒤바뀐다
    // (네이버 결과 대조 187/187 swap, 축구 47/48 정상). spotv-tv(parsers.ts)와 동일하게 야구만 swap.
    const swap = sport === "야구";
    for (const live of game.lives) {
      const [actualDate, time] = game.beginDate.split(" "); // "YYYY-MM-DD", "HH:mm"
      if (actualDate !== date) continue;
      schedules.push({
        id: `spotvnow-${date}-${live.id}`,
        date,
        time,
        sport,
        league: leagueName,
        homeTeam: swap ? desc.awayName : desc.homeName,
        awayTeam: swap ? desc.homeName : desc.awayName,
        platform: "SPOTV NOW",
        koreanCommentary: languageToCommentary(live.language),
      });
    }
  }

  return schedules;
}

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

    const sport = SPORT_MAP[desc.typeName];
    if (!sport) continue;

    for (const live of game.lives) {
      const [actualDate, time] = game.beginDate.split(" "); // "YYYY-MM-DD", "HH:mm"
      if (actualDate !== date) continue;
      schedules.push({
        id: `spotvnow-${date}-${live.id}`,
        date,
        time,
        sport,
        league: normalizeLeague(desc.leagueNameFull || desc.leagueName),
        homeTeam: desc.homeName,
        awayTeam: desc.awayName,
        platform: "SPOTV NOW",
        koreanCommentary: languageToCommentary(live.language),
      });
    }
  }

  return schedules;
}

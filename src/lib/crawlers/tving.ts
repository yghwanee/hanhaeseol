import { Schedule, Sport } from "@/types/schedule";

interface TvingGame {
  code: string;
  dateTime: number;       // 202604081830
  stadium: string;
  status: string;         // PREV, NOW, END, CANCEL, SUSPENDED
  away: { code: string; name: string };
  home: { code: string; name: string };
}

const SPORT_CONFIG: { path: string; sport: Sport; league: string }[] = [
  { path: "kbo", sport: "야구", league: "KBO" },
  { path: "kbl", sport: "농구", league: "KBL" },
];

export async function crawlTving(date: string): Promise<Schedule[]> {
  const dateCompact = date.replace(/-/g, "");
  const schedules: Schedule[] = [];

  for (const { path, sport, league } of SPORT_CONFIG) {
    const url = `https://gw.tving.com/bff/sports/v2/${path}/schedule?date=${dateCompact}`;

    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "Mozilla/5.0" },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        console.error(`티빙 ${league}: HTTP ${res.status}`);
        continue;
      }

      const data = await res.json();
      if (data.code !== "0000") continue;

      const items: TvingGame[] = data?.data?.bands?.[0]?.items || [];

      for (const game of items) {
        if (game.status === "CANCEL") continue;

        const dt = String(game.dateTime);
        const actualDate = `${dt.substring(0, 4)}-${dt.substring(4, 6)}-${dt.substring(6, 8)}`;
        const time = `${dt.substring(8, 10)}:${dt.substring(10, 12)}`;

        if (actualDate !== date) continue;

        schedules.push({
          id: `tving-${date}-${time}-${league}-${game.away.name}-${game.home.name}`,
          date,
          time,
          sport,
          league,
          homeTeam: game.home.name,
          awayTeam: game.away.name,
          platform: "티빙",
          koreanCommentary: true,
        });
      }
    } catch {
      console.error(`티빙 ${league}: 요청 실패`);
    }
  }

  return schedules;
}

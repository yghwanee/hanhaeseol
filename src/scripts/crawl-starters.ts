import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import type { StartersData, MatchStarters } from "@/types/starter";
import { fetchGameList, fetchStarters } from "@/lib/starters/naver";
import { buildStarterKey } from "@/lib/starters/lookup";
import { normalizeTeamName } from "@/lib/starters/teams";

const LEAGUES: Array<{ categoryId: string; league: "kbo" | "mlb" }> = [
  { categoryId: "kbo", league: "kbo" },
  { categoryId: "mlb", league: "mlb" },
];
const DAYS = 7;
const SLEEP_MS = 400;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function rangeDates(today: string, days: number): string[] {
  const [y, m, d] = today.split("-").map(Number);
  const out: string[] = [];
  for (let i = 0; i < days; i++) {
    out.push(new Date(Date.UTC(y, m - 1, d + i)).toISOString().slice(0, 10));
  }
  return out;
}

async function main() {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const dates = rangeDates(today, DAYS);
  const starters: Record<string, MatchStarters> = {};

  for (const { categoryId, league } of LEAGUES) {
    for (const date of dates) {
      let games;
      try {
        games = await fetchGameList(categoryId, date, date);
      } catch (e) {
        console.warn(`[starters] list fail ${categoryId} ${date}: ${(e as Error).message}`);
        continue;
      }
      for (const g of games) {
        await sleep(SLEEP_MS);
        let s;
        try {
          s = await fetchStarters(g.gameId);
        } catch (e) {
          console.warn(`[starters] preview fail ${g.gameId}: ${(e as Error).message}`);
          continue;
        }
        if (!s.home && !s.away) continue;
        const teams: MatchStarters["teams"] = {};
        if (s.home) teams[normalizeTeamName(g.homeTeamName)] = s.home;
        if (s.away) teams[normalizeTeamName(g.awayTeamName)] = s.away;
        starters[buildStarterKey(g.gameDate, g.homeTeamName, g.awayTeamName)] = {
          league,
          teams,
        };
      }
    }
  }

  const data: StartersData = {
    lastUpdated: new Date().toISOString(),
    starters,
  };
  const out = path.join(process.cwd(), "src/data/starters.json");
  fs.writeFileSync(out, JSON.stringify(data, null, 2) + "\n");
  console.log(`[starters] wrote ${Object.keys(starters).length} matches → ${out}`);
}

main().catch((err) => {
  console.error("[starters] fatal:", err);
  process.exit(1);
});

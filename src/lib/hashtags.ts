import fs from "node:fs";

const LEAGUE_HASHTAGS: Record<string, string> = {
  "프리미어리그": "#프리미어리그",
  "라리가": "#라리가",
  "분데스리가": "#분데스리가",
  "세리에A": "#세리에A",
  "리그 1": "#리그앙",
  "챔피언스리그": "#챔스",
  "유로파리그": "#유로파",
  "컨퍼런스리그": "#컨퍼런스리그",
  "K리그": "#K리그",
  "K리그2": "#K리그",
  "ACL": "#ACL",
  "MLS": "#MLS",
  "잉글랜드 FA컵": "#FA컵",
  "MLB": "#MLB",
  "KBO": "#KBO",
  "NBA": "#NBA",
  "KBL": "#KBL",
  "WKBL": "#WKBL",
};

export function getDynamicLeagueTags(today: string, max: number): string[] {
  try {
    const raw = fs.readFileSync("public/schedule.json", "utf-8");
    const data = JSON.parse(raw) as { schedules: Array<{ date: string; league: string; koreanCommentary: boolean | "unknown" }> };
    const leagues = new Set<string>();
    for (const s of data.schedules) {
      if (s.date === today && s.koreanCommentary === true) leagues.add(s.league);
    }
    const tags: string[] = [];
    const seen = new Set<string>();
    for (const lg of leagues) {
      const tag = LEAGUE_HASHTAGS[lg];
      if (!tag || seen.has(tag)) continue;
      seen.add(tag);
      tags.push(tag);
      if (tags.length >= max) break;
    }
    return tags;
  } catch {
    return [];
  }
}

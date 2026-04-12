import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findEnglishTeamName } from "@/data/team-names";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// schedule.json 리그명 → apwin URL 리그 slug
const LEAGUE_SLUG: Record<string, string> = {
  "프리미어리그": "premier-league",
  "라리가": "la-liga",
  "세리에A": "serie-a",
  "분데스리가": "bundesliga",
  "리그 1": "ligue-1",
  "리그1": "ligue-1",
  "챔피언스리그": "champions-league",
  "유로파리그": "europa-league",
  "컨퍼런스리그": "conference-league",
  "EFL 챔피언십": "championship",
  "MLS": "mls",
};

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

function toDateSlug(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

async function fetchArticle(url: string): Promise<{ prediction: string; content: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
    redirect: "manual",
  });

  if (!res.ok) return null;

  const html = await res.text();

  const paragraphs: string[] = [];
  const pPattern = new RegExp("<p>([^<]{40,})</p>", "g");
  let pMatch;
  while ((pMatch = pPattern.exec(html)) !== null) {
    const text = pMatch[1]
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#039;/g, "'")
      .replace(/&#\d+;/g, "")
      .trim();
    if (
      !text.includes("cookie") &&
      !text.includes("APWin simplifies") &&
      !text.includes("All rights reserved") &&
      !text.includes("social media") &&
      !text.includes("Please type at least")
    ) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length === 0) return null;

  let prediction = "";
  // 메인 예측: "Under 3.5 Goals" 같은 것
  const predMatch = html.match(/title is-2[^>]*>\s*([^<]+)/);
  if (predMatch) prediction = predMatch[1].trim();

  return { prediction, content: paragraphs.join("\n\n") };
}

export async function crawlApwin(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanFootball = schedules.filter(
    (s) => s.date === date && s.sport === "축구" && s.koreanCommentary === true
  );
  console.log(`  apwin: 한국어해설 축구 ${koreanFootball.length}개 경기에서 분석글 탐색...`);

  const dateSlug = toDateSlug(date);
  const articles: AnalysisArticle[] = [];

  for (const schedule of koreanFootball) {
    const leagueSlug = LEAGUE_SLUG[schedule.league];
    if (!leagueSlug) continue;

    const homeEn = findEnglishTeamName(schedule.homeTeam);
    const awayEn = findEnglishTeamName(schedule.awayTeam);
    if (!homeEn || !awayEn) continue;

    const url = `https://www.apwin.com/predictions/${toSlug(homeEn)}-vs-${toSlug(awayEn)}-prediction-${leagueSlug}-${dateSlug}/`;

    const result = await fetchArticle(url);
    if (!result) {
      const reverseUrl = `https://www.apwin.com/predictions/${toSlug(awayEn)}-vs-${toSlug(homeEn)}-prediction-${leagueSlug}-${dateSlug}/`;
      const reverseResult = await fetchArticle(reverseUrl);
      if (!reverseResult) continue;

      console.log(`  ✓ ${homeEn} vs ${awayEn} (reverse)`);
      articles.push({
        id: `${date}-apwin-${toSlug(homeEn)}-vs-${toSlug(awayEn)}`,
        date,
        time: schedule.time,
        sport: schedule.sport,
        league: schedule.league,
        homeTeam: schedule.homeTeam,
        awayTeam: schedule.awayTeam,
        homeTeamEn: homeEn,
        awayTeamEn: awayEn,
        sourceUrl: reverseUrl,
        prediction: reverseResult.prediction,
        content: reverseResult.content,
        crawledAt: new Date().toISOString(),
      });
      continue;
    }

    console.log(`  ✓ ${homeEn} vs ${awayEn}`);
    articles.push({
      id: `${date}-apwin-${toSlug(homeEn)}-vs-${toSlug(awayEn)}`,
      date,
      time: schedule.time,
      sport: schedule.sport,
      league: schedule.league,
      homeTeam: schedule.homeTeam,
      awayTeam: schedule.awayTeam,
      homeTeamEn: homeEn,
      awayTeamEn: awayEn,
      sourceUrl: url,
      prediction: result.prediction,
      content: result.content,
      crawledAt: new Date().toISOString(),
    });
  }

  console.log(`  apwin: ${articles.length}건 수집`);
  return articles;
}

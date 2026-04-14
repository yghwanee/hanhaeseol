import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findKoreanTeamName } from "@/data/team-names";
import { curlFetch, toSlug, pLimit } from "./_utils";

interface LeagueTarget {
  listingUrl: string;
  matchupPrefix: string; // e.g. /sport/baseball/mlb/matchup/
  sport: string; // 야구 | 농구
  league: string; // MLB | NBA
  idTag: string; // used in article id
}

const TARGETS: LeagueTarget[] = [
  {
    listingUrl: "https://www.covers.com/sport/baseball/mlb/odds",
    matchupPrefix: "/sport/baseball/mlb/matchup/",
    sport: "야구",
    league: "MLB",
    idTag: "covers",
  },
  {
    listingUrl: "https://www.covers.com/sport/basketball/nba/odds",
    matchupPrefix: "/sport/basketball/nba/matchup/",
    sport: "농구",
    league: "NBA",
    idTag: "covers",
  },
];

function fetchMatchupIds(t: LeagueTarget): string[] {
  const html = curlFetch(t.listingUrl);
  if (!html) return [];
  const re = new RegExp(`${t.matchupPrefix}(\\d+)`, "g");
  const ids = new Set<string>();
  let m;
  while ((m = re.exec(html)) !== null) ids.add(m[1]);
  return [...ids];
}

// startDate: "04/14/2026 22:40:00 +00:00" (UTC) → { dateKst, timeKst }
function utcToKst(raw: string): { dateKst: string; timeKst: string } | null {
  const cleaned = raw.replace(/&#x2B;/g, "+").trim();
  const m = cleaned.match(/^(\d{2})\/(\d{2})\/(\d{4})\s+(\d{2}):(\d{2}):\d{2}/);
  if (!m) return null;
  const [, mm, dd, yyyy, hh, mi] = m;
  const utc = new Date(Date.UTC(+yyyy, +mm - 1, +dd, +hh, +mi));
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    dateKst: `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`,
    timeKst: `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`,
  };
}

interface ParsedDetail {
  homeTeamEn: string;
  awayTeamEn: string;
  dateKst: string;
  timeKst: string;
  prediction: string;
  content: string;
}

function parseDetail(html: string): ParsedDetail | null {
  // ld+json SportsEvent
  const ld = html.match(
    /<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/
  );
  if (!ld) return null;
  let home = "";
  let away = "";
  let start = "";
  {
    const raw = ld[1];
    const mStart = raw.match(/"startDate"\s*:\s*"([^"]+)"/);
    const mHome = raw.match(
      /"homeTeam"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/
    );
    const mAway = raw.match(
      /"awayTeam"\s*:\s*\{[^}]*?"name"\s*:\s*"([^"]+)"/
    );
    if (!mStart || !mHome || !mAway) return null;
    start = mStart[1];
    home = mHome[1];
    away = mAway[1];
  }
  const kst = utcToKst(start);
  if (!kst) return null;

  // Preview paragraphs: everything inside <div id="TP_preview"> ... before </section>
  const prev = html.match(
    /id="TP_preview"[\s\S]*?<section\b|id="TP_preview"[\s\S]*?<\/section>/
  );
  if (!prev) return null;
  const block = prev[0];

  const paragraphs: string[] = [];
  const pRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
  let pm;
  while ((pm = pRe.exec(block)) !== null) {
    const text = pm[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#x27;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&#\d+;/g, "")
      .replace(/\s+/g, " ")
      .trim();
    if (text.length > 40 && !/Last Meeting/i.test(text)) {
      paragraphs.push(text);
    }
  }
  if (paragraphs.length === 0) return null;

  return {
    homeTeamEn: home,
    awayTeamEn: away,
    dateKst: kst.dateKst,
    timeKst: kst.timeKst,
    prediction: paragraphs[0],
    content: paragraphs.join("\n\n"),
  };
}


export async function crawlCovers(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanMatches = schedules.filter(
    (s) => s.date === date 
  );
  if (koreanMatches.length === 0) return [];

  const articles: AnalysisArticle[] = [];

  for (const t of TARGETS) {
    const ids = fetchMatchupIds(t);
    console.log(`  covers(${t.league}): ${ids.length}개 매치업`);

    const parsed = await pLimit(ids, 5, async (id) => {
      const url = `https://www.covers.com${t.matchupPrefix}${id}`;
      const html = curlFetch(url);
      if (!html) return null;
      const p = parseDetail(html);
      return p ? { url, p } : null;
    });

    for (const entry of parsed) {
      if (!entry) continue;
      const { url, p } = entry;
      if (p.dateKst !== date) continue;

      const homeKo = findKoreanTeamName(p.homeTeamEn);
      const awayKo = findKoreanTeamName(p.awayTeamEn);
      if (!homeKo || !awayKo) continue;

      const matched = koreanMatches.find(
        (s) =>
          s.sport === t.sport &&
          ((s.homeTeam.includes(homeKo) && s.awayTeam.includes(awayKo)) ||
            (s.homeTeam.includes(awayKo) && s.awayTeam.includes(homeKo)))
      );
      if (!matched) continue;

      console.log(
        `  ✓ ${p.awayTeamEn} at ${p.homeTeamEn} → ${awayKo} vs ${homeKo}`
      );

      articles.push({
        id: `${date}-${t.idTag}-${toSlug(p.awayTeamEn)}-vs-${toSlug(p.homeTeamEn)}`,
        date,
        time: matched.time,
        sport: matched.sport,
        league: matched.league,
        homeTeam: matched.homeTeam,
        awayTeam: matched.awayTeam,
        homeTeamEn: p.homeTeamEn,
        awayTeamEn: p.awayTeamEn,
        sourceUrl: url,
        prediction: p.prediction,
        content: p.content,
        crawledAt: new Date().toISOString(),
      });
    }
  }

  console.log(`  covers: ${articles.length}건 수집`);
  return articles;
}

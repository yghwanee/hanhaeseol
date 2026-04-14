import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findKoreanTeamName } from "@/data/team-names";
import { curlFetch, toSlug, stripTags, pLimit } from "./_utils";

interface LeagueTarget {
  listingUrl: string;
  sport: string; // 야구 | 농구
}

const TARGETS: LeagueTarget[] = [
  { listingUrl: "https://pickdawgz.com/mlb-picks/", sport: "야구" },
  { listingUrl: "https://pickdawgz.com/nba-picks/", sport: "농구" },
];

function fetchDetailUrls(listingUrl: string): string[] {
  const html = curlFetch(listingUrl);
  if (!html) return [];
  const re = /href="(https:\/\/pickdawgz\.com\/[a-z]+-picks\/[a-z0-9-]+-\d{4}-\d{2}-\d{2}\/)"/g;
  const set = new Set<string>();
  let m;
  while ((m = re.exec(html)) !== null) set.add(m[1]);
  return [...set];
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
  // SportsEvent 블록 (NewsArticle.about 안 또는 최상위)
  const seMatch = html.match(/"@type":"SportsEvent"[\s\S]*?\}(?=,"image"|\}\s*,\s*\{"@type"|$)/);
  const seBlock = seMatch ? seMatch[0] : html;

  const mStart = seBlock.match(/"startDate":"([^"]+)"/);
  const mDesc = seBlock.match(/"description":"([^"]+)"/);
  const perfRe = /"@type":"SportsTeam","name":"([^"]+)"/g;
  const performers: string[] = [];
  let pm;
  while ((pm = perfRe.exec(seBlock)) !== null) performers.push(pm[1]);
  if (!mStart || !mDesc || performers.length < 2) return null;

  // description: "New York Mets at Los Angeles Dodgers - MLB game..." → away at home
  const descMatch = mDesc[1].match(/^(.+?)\s+at\s+(.+?)\s*-/);
  let awayTeamEn = "";
  let homeTeamEn = "";
  if (descMatch) {
    awayTeamEn = descMatch[1].trim();
    homeTeamEn = descMatch[2].trim();
  } else {
    [awayTeamEn, homeTeamEn] = performers;
  }

  // KST 변환
  const utc = new Date(mStart[1]);
  if (isNaN(utc.getTime())) return null;
  const kst = new Date(utc.getTime() + 9 * 60 * 60 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const dateKst = `${kst.getUTCFullYear()}-${pad(kst.getUTCMonth() + 1)}-${pad(kst.getUTCDate())}`;
  const timeKst = `${pad(kst.getUTCHours())}:${pad(kst.getUTCMinutes())}`;

  // entry-content 본문 추출
  const ec = html.match(/<div class="entry-content[^"]*"[^>]*>([\s\S]*?)<\/article>/);
  if (!ec) return null;
  const body = ec[1];

  // Pick 라인 (Randy Chambers's Pick: ...)
  const pickMatch = body.match(/<h3[^>]*>([^<]*Pick:[^<]+)<\/h3>/i);
  const pick = pickMatch ? stripTags(pickMatch[1]) : "";

  // 단락 추출 (<p>, <li>)
  const paragraphs: string[] = [];
  const blockRe = /<(p|li)[^>]*>([\s\S]*?)<\/\1>/g;
  let bm;
  while ((bm = blockRe.exec(body)) !== null) {
    const text = stripTags(bm[2]);
    if (
      text.length >= 40 &&
      !/pickd-highlight|utm_source|Advertisement/i.test(text)
    ) {
      paragraphs.push(text);
    }
  }
  if (paragraphs.length === 0) return null;

  const prediction = pick || paragraphs[paragraphs.length - 1];
  const content = paragraphs.join("\n\n");

  return { homeTeamEn, awayTeamEn, dateKst, timeKst, prediction, content };
}

export async function crawlPickdawgz(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanMatches = schedules.filter((s) => s.date === date);
  if (koreanMatches.length === 0) return [];

  const articles: AnalysisArticle[] = [];

  for (const t of TARGETS) {
    const urls = fetchDetailUrls(t.listingUrl);
    console.log(`  pickdawgz(${t.sport}): ${urls.length}개 링크`);

    const parsed = await pLimit(urls, 5, async (url) => {
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
        id: `${date}-pickdawgz-${toSlug(p.awayTeamEn)}-vs-${toSlug(p.homeTeamEn)}`,
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

  console.log(`  pickdawgz: ${articles.length}건 수집`);
  return articles;
}

import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findKoreanTeamName } from "@/data/team-names";
import { execSync } from "child_process";

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function curlFetch(url: string): string | null {
  try {
    const html = execSync(`curl -sL -A "${UA}" --max-time 20 "${url}"`, {
      timeout: 25000,
      maxBuffer: 10 * 1024 * 1024,
    }).toString();
    if (html.length < 1000) return null;
    return html;
  } catch {
    return null;
  }
}

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

function stripTags(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#8217;/g, "'")
    .replace(/&#8216;/g, "'")
    .replace(/&#8220;|&#8221;/g, '"')
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
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

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function crawlPickdawgz(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanMatches = schedules.filter(
    (s) => s.date === date && s.koreanCommentary === true
  );
  if (koreanMatches.length === 0) return [];

  const articles: AnalysisArticle[] = [];

  for (const t of TARGETS) {
    const urls = fetchDetailUrls(t.listingUrl);
    console.log(`  pickdawgz(${t.sport}): ${urls.length}개 링크`);

    for (const url of urls) {
      const html = curlFetch(url);
      if (!html) continue;
      const parsed = parseDetail(html);
      if (!parsed) continue;
      if (parsed.dateKst !== date) continue;

      const homeKo = findKoreanTeamName(parsed.homeTeamEn);
      const awayKo = findKoreanTeamName(parsed.awayTeamEn);
      if (!homeKo || !awayKo) continue;

      const matched = koreanMatches.find(
        (s) =>
          s.sport === t.sport &&
          ((s.homeTeam.includes(homeKo) && s.awayTeam.includes(awayKo)) ||
            (s.homeTeam.includes(awayKo) && s.awayTeam.includes(homeKo)))
      );
      if (!matched) continue;

      console.log(
        `  ✓ ${parsed.awayTeamEn} at ${parsed.homeTeamEn} → ${awayKo} vs ${homeKo}`
      );

      articles.push({
        id: `${date}-pickdawgz-${toSlug(parsed.awayTeamEn)}-vs-${toSlug(parsed.homeTeamEn)}`,
        date,
        time: matched.time,
        sport: matched.sport,
        league: matched.league,
        homeTeam: matched.homeTeam,
        awayTeam: matched.awayTeam,
        homeTeamEn: parsed.homeTeamEn,
        awayTeamEn: parsed.awayTeamEn,
        sourceUrl: url,
        prediction: parsed.prediction,
        content: parsed.content,
        crawledAt: new Date().toISOString(),
      });
    }
  }

  console.log(`  pickdawgz: ${articles.length}건 수집`);
  return articles;
}

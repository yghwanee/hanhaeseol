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
  keyword: string; // used to filter category posts (must be in slug)
}

const TARGETS: LeagueTarget[] = [
  {
    listingUrl: "https://www.tonyspicks.com/category/freepicks/free-mlb-picks/",
    sport: "야구",
    keyword: "free-mlb-picks-for-today",
  },
  {
    listingUrl: "https://www.tonyspicks.com/category/free-nba-picks/",
    sport: "농구",
    keyword: "free-nba-picks-for-today",
  },
];

// slug 끝의 M-D-YYYY → ISO date (US)
function slugToUsDate(url: string): string | null {
  const m = url.match(/-(\d{1,2})-(\d{1,2})-(\d{4})(?:-\d+)?\/$/);
  if (!m) return null;
  const [, mm, dd, yyyy] = m;
  return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
}

function fetchPostUrls(t: LeagueTarget, targetUsDate: string): string[] {
  const html = curlFetch(t.listingUrl);
  if (!html) return [];
  const re = /href="(https:\/\/www\.tonyspicks\.com\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/)"/g;
  const set = new Set<string>();
  let m;
  while ((m = re.exec(html)) !== null) {
    if (!m[1].includes(t.keyword)) continue;
    if (slugToUsDate(m[1]) === targetUsDate) set.add(m[1]);
  }
  return [...set];
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

interface GameSection {
  awayTeamEn: string;
  homeTeamEn: string;
  content: string;
  prediction: string;
}

function parsePost(html: string): GameSection[] {
  // <h2>Team A vs. Team B SPORT Pick Prediction</h2> 로 분할
  const sectionRe =
    /<h2[^>]*>([^<]+?)\s+vs\.?\s+([^<]+?)\s+(?:MLB|NBA)\s+Pick\s+Prediction<\/h2>([\s\S]*?)(?=<h2|<footer|<\/article|<div class="entry-footer)/gi;
  const games: GameSection[] = [];
  let m;
  while ((m = sectionRe.exec(html)) !== null) {
    const away = stripTags(m[1]);
    const home = stripTags(m[2]);
    const body = m[3];

    const paragraphs: string[] = [];
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pm;
    while ((pm = pRe.exec(body)) !== null) {
      const inner = pm[1].trim();
      const text = stripTags(inner);
      // 본문 <a>만 있는 단락(예: "More MLB Picks..." 링크) 제외
      const isLinkOnly = /^<a\b[^>]*>[\s\S]*?<\/a>$/i.test(inner);
      if (
        text.length >= 30 &&
        !isLinkOnly &&
        !/youtube|rll-youtube/i.test(inner) &&
        text.toLowerCase() !== "the pick:"
      ) {
        paragraphs.push(text);
      }
    }
    if (paragraphs.length === 0) continue;

    // 마지막 단락이 실제 Pick
    const prediction = paragraphs[paragraphs.length - 1];
    const content = paragraphs.join("\n\n");

    games.push({
      awayTeamEn: away,
      homeTeamEn: home,
      content,
      prediction,
    });
  }
  return games;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function crawlTonyspicks(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanMatches = schedules.filter(
    (s) => s.date === date && s.koreanCommentary === true
  );
  if (koreanMatches.length === 0) return [];

  const articles: AnalysisArticle[] = [];

  // MLB/NBA는 ET 저녁 경기 = KST 다음날. 포스트 slug 날짜는 경기의 US 현지 날짜.
  const usDate = (() => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  for (const t of TARGETS) {
    const urls = fetchPostUrls(t, usDate);
    console.log(`  tonyspicks(${t.sport}): ${urls.length}개 포스트 (us=${usDate})`);

    for (const url of urls) {
      const html = curlFetch(url);
      if (!html) continue;
      const games = parsePost(html);

      for (const g of games) {
        const homeKo = findKoreanTeamName(g.homeTeamEn);
        const awayKo = findKoreanTeamName(g.awayTeamEn);
        if (!homeKo || !awayKo) continue;

        const matched = koreanMatches.find(
          (s) =>
            s.sport === t.sport &&
            ((s.homeTeam.includes(homeKo) && s.awayTeam.includes(awayKo)) ||
              (s.homeTeam.includes(awayKo) && s.awayTeam.includes(homeKo)))
        );
        if (!matched) continue;

        // 중복 방지
        const id = `${date}-tonyspicks-${toSlug(g.awayTeamEn)}-vs-${toSlug(g.homeTeamEn)}`;
        if (articles.some((a) => a.id === id)) continue;

        console.log(
          `  ✓ ${g.awayTeamEn} at ${g.homeTeamEn} → ${awayKo} vs ${homeKo}`
        );

        articles.push({
          id,
          date,
          time: matched.time,
          sport: matched.sport,
          league: matched.league,
          homeTeam: matched.homeTeam,
          awayTeam: matched.awayTeam,
          homeTeamEn: g.homeTeamEn,
          awayTeamEn: g.awayTeamEn,
          sourceUrl: url,
          prediction: g.prediction,
          content: g.content,
          crawledAt: new Date().toISOString(),
        });
      }
    }
  }

  console.log(`  tonyspicks: ${articles.length}건 수집`);
  return articles;
}

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

type PostType = "baseballBasketball" | "soccer";

interface LeagueTarget {
  listingUrl: string;
  sport: string; // 야구 | 농구 | 축구
  // URL이 이 문자열 중 하나라도 포함하면 대상 포스트
  keywords: string[];
  postType: PostType;
}

const TARGETS: LeagueTarget[] = [
  {
    listingUrl: "https://www.tonyspicks.com/category/freepicks/free-mlb-picks/",
    sport: "야구",
    keywords: ["free-mlb-picks-for-today"],
    postType: "baseballBasketball",
  },
  {
    listingUrl: "https://www.tonyspicks.com/category/free-nba-picks/",
    sport: "농구",
    keywords: ["free-nba-picks-for-today"],
    postType: "baseballBasketball",
  },
  {
    listingUrl: "https://www.tonyspicks.com/category/free-soccer-picks/",
    sport: "축구",
    keywords: ["-soccer-picks", "-soccer-prediction"],
    postType: "soccer",
  },
];

const MONTHS: Record<string, string> = {
  january: "01", february: "02", march: "03", april: "04",
  may: "05", june: "06", july: "07", august: "08",
  september: "09", october: "10", november: "11", december: "12",
};

// slug에서 ISO US date 추출 (숫자 M-D-YYYY 또는 텍스트 month-D-YYYY)
function slugToUsDate(url: string): string | null {
  const textMatch = url.match(/-(january|february|march|april|may|june|july|august|september|october|november|december)-(\d{1,2})-(\d{4})/i);
  if (textMatch) {
    const mm = MONTHS[textMatch[1].toLowerCase()];
    const dd = textMatch[2].padStart(2, "0");
    return `${textMatch[3]}-${mm}-${dd}`;
  }
  const numMatch = url.match(/-(\d{1,2})-(\d{1,2})-(\d{4})(?:-\d+)?\/$/);
  if (numMatch) {
    const [, mm, dd, yyyy] = numMatch;
    return `${yyyy}-${mm.padStart(2, "0")}-${dd.padStart(2, "0")}`;
  }
  return null;
}

function fetchPostUrls(t: LeagueTarget, targetUsDate: string): string[] {
  const html = curlFetch(t.listingUrl);
  if (!html) return [];
  const re = /href="(https:\/\/www\.tonyspicks\.com\/\d{4}\/\d{2}\/\d{2}\/[a-z0-9-]+\/)"/g;
  const set = new Set<string>();
  let m;
  while ((m = re.exec(html)) !== null) {
    const url = m[1];
    if (!t.keywords.some((k) => url.includes(k))) continue;
    if (slugToUsDate(url) === targetUsDate) set.add(url);
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
  // soccer: homeTeam은 h2의 첫 팀 (home vs away)
  // baseball/basketball: 첫 팀이 away (away at home)
  teamA: string;
  teamB: string;
  aIsAway: boolean; // true = teamA가 away (MLB/NBA), false = teamA가 home (soccer)
  content: string;
  prediction: string;
}

function parseBaseballBasketball(html: string): GameSection[] {
  const sectionRe =
    /<h2[^>]*>([^<]+?)\s+vs\.?\s+([^<]+?)\s+(?:MLB|NBA)\s+Pick\s+Prediction<\/h2>([\s\S]*?)(?=<h2|<footer|<\/article|<div class="entry-footer)/gi;
  const games: GameSection[] = [];
  let m;
  while ((m = sectionRe.exec(html)) !== null) {
    const teamA = stripTags(m[1]);
    const teamB = stripTags(m[2]);
    const body = m[3];

    const paragraphs: string[] = [];
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pm;
    while ((pm = pRe.exec(body)) !== null) {
      const inner = pm[1].trim();
      const text = stripTags(inner);
      const isLinkOnly = /^<a\b[^>]*>[\s\S]*?<\/a>$/i.test(inner);
      if (
        text.length >= 30 &&
        !isLinkOnly &&
        !/youtube|rll-youtube/i.test(inner) &&
        text.toLowerCase() !== "the pick:"
      ) {
        // "Team at Team 6:35PM ET— " 서두 제거
        const cleaned = text.replace(
          /^[A-Z][A-Za-z.\s]+?\s+at\s+[A-Z][A-Za-z.\s]+?\s+\d{1,2}:\d{2}\s?(?:AM|PM)?\s*ET\s*[—–-]+\s*/,
          ""
        );
        paragraphs.push(cleaned);
      }
    }
    if (paragraphs.length === 0) continue;

    games.push({
      teamA,
      teamB,
      aIsAway: true,
      content: paragraphs.join("\n\n"),
      prediction: paragraphs[paragraphs.length - 1],
    });
  }
  return games;
}

function parseSoccer(html: string): GameSection[] {
  // <h2>[<b>]X vs Y Best Bets[</b>]</h2> 다음 분석 <p>, 그리고 "Free Pick:" h2
  const sectionRe =
    /<h2[^>]*>\s*(?:<b>)?\s*([^<]+?)\s+vs\.?\s+([^<]+?)\s+Best\s+Bets\s*(?:<\/b>)?\s*<\/h2>([\s\S]*?)(?=<h2[^>]*>\s*(?:<b>)?[^<]+?\s+vs\.?\s+[^<]+?\s+Best\s+Bets|<footer|<\/article|<div class="entry-footer)/gi;
  const games: GameSection[] = [];
  let m;
  while ((m = sectionRe.exec(html)) !== null) {
    const teamA = stripTags(m[1]);
    const teamB = stripTags(m[2]);
    const body = m[3];

    const paragraphs: string[] = [];
    const pRe = /<p[^>]*>([\s\S]*?)<\/p>/g;
    let pm;
    while ((pm = pRe.exec(body)) !== null) {
      const inner = pm[1].trim();
      const text = stripTags(inner);
      const isLinkOnly = /^<a\b[^>]*>[\s\S]*?<\/a>$/i.test(inner);
      if (text.length >= 30 && !isLinkOnly && !/youtube|rll-youtube/i.test(inner)) {
        paragraphs.push(text);
      }
    }

    // "Free Pick:" 섹션 (h2 내부)
    const pickH2 = body.match(/<h2[^>]*>([\s\S]*?Free\s+Pick[\s\S]*?)<\/h2>/i);
    let prediction = "";
    if (pickH2) {
      prediction = stripTags(pickH2[1]);
    } else if (paragraphs.length > 0) {
      prediction = paragraphs[paragraphs.length - 1];
    } else {
      continue;
    }

    if (paragraphs.length === 0 && !prediction) continue;

    const contentParts = [...paragraphs];
    if (prediction) contentParts.push(prediction);

    games.push({
      teamA,
      teamB,
      aIsAway: false, // soccer: teamA = home
      content: contentParts.join("\n\n"),
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
  const dateMatches = schedules.filter((s) => s.date === date);
  if (dateMatches.length === 0) return [];

  const articles: AnalysisArticle[] = [];

  // MLB/NBA/축구 저녁 경기 대부분 slug US date = KST date - 1
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
      const games =
        t.postType === "soccer" ? parseSoccer(html) : parseBaseballBasketball(html);

      for (const g of games) {
        const awayEn = g.aIsAway ? g.teamA : g.teamB;
        const homeEn = g.aIsAway ? g.teamB : g.teamA;
        const homeKo = findKoreanTeamName(homeEn);
        const awayKo = findKoreanTeamName(awayEn);
        if (!homeKo || !awayKo) continue;

        const matched = dateMatches.find(
          (s) =>
            s.sport === t.sport &&
            ((s.homeTeam.includes(homeKo) && s.awayTeam.includes(awayKo)) ||
              (s.homeTeam.includes(awayKo) && s.awayTeam.includes(homeKo)))
        );
        if (!matched) continue;

        const id = `${date}-tonyspicks-${toSlug(awayEn)}-vs-${toSlug(homeEn)}`;
        if (articles.some((a) => a.id === id)) continue;

        console.log(
          `  ✓ ${awayEn} at ${homeEn} → ${awayKo} vs ${homeKo}`
        );

        articles.push({
          id,
          date,
          time: matched.time,
          sport: matched.sport,
          league: matched.league,
          homeTeam: matched.homeTeam,
          awayTeam: matched.awayTeam,
          homeTeamEn: homeEn,
          awayTeamEn: awayEn,
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

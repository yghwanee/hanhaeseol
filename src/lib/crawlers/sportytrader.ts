import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findKoreanTeamName } from "@/data/team-names";
import { curlFetch, toSlug, pLimit } from "./_utils";

interface MatchPreview {
  slug: string;
  url: string;
}

// 여러 페이지에서 분석글 링크 수집 (메인 + NBA 카테고리)
function fetchPredictionsList(): MatchPreview[] {
  const pages = [
    "https://www.sportytrader.com/en/",
    "https://www.sportytrader.com/en/betting-tips/basketball/usa/nba-306/",
    "https://www.sportytrader.com/us/picks/",
  ];

  const matches: MatchPreview[] = [];

  for (const pageUrl of pages) {
    const html = curlFetch(pageUrl);
    if (!html) continue;

    const linkPattern = /\/(?:en\/betting-tips|us\/picks)\/([a-z0-9][a-z0-9-]*-\d+)\//g;
    let match;

    while ((match = linkPattern.exec(html)) !== null) {
      const section = match[0].includes("/us/picks/") ? "us/picks" : "en/betting-tips";
      const slug = match[1];
      const url = `https://www.sportytrader.com/${section}/${slug}/`;
      if (!matches.some((m) => m.url === url)) {
        matches.push({ slug, url });
      }
    }
  }

  return matches;
}

function fetchArticle(url: string): {
  homeTeamEn: string;
  awayTeamEn: string;
  prediction: string;
  content: string;
} | null {
  const html = curlFetch(url);
  if (!html) return null;

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  let homeTeamEn = "";
  let awayTeamEn = "";

  if (titleMatch) {
    const decoded = titleMatch[1].replace(/&amp;/g, "&").replace(/&#\d+;/g, "");
    const vsMatch = decoded.match(/(.+?)\s+vs\s+(.+?)\s+(?:Prediction|Picks|Betting|Tips)/i);
    if (vsMatch) {
      homeTeamEn = vsMatch[1].trim();
      awayTeamEn = vsMatch[2].trim();
    }
  }
  if (!homeTeamEn || !awayTeamEn) return null;

  let prediction = "";
  const predMatch = html.match(/text-center text-xl font-semibold[^>]*>([^<]+)/);
  if (predMatch) prediction = predMatch[1].trim();

  const paragraphs: string[] = [];
  const pPattern = new RegExp("<p>([^<]{40,})</p>", "g");
  let pMatch;
  while ((pMatch = pPattern.exec(html)) !== null) {
    const text = pMatch[1].replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, "").trim();
    if (
      !text.includes("1xbet") && !text.includes("Probabilities according") &&
      !text.includes("Our prediction for the") && !text.includes("Fair odds")
    ) {
      paragraphs.push(text);
    }
  }

  const content = cleanContent(paragraphs.join("\n\n"));
  if (!content) return null;

  return { homeTeamEn, awayTeamEn, prediction, content };
}

function cleanContent(text: string): string {
  const cutoffPhrases = [
    "Sign Up", "GambleAware", "responsible gambling", "You must be 18",
    "Bet responsibly", "cookie", "Terms and Conditions",
    // 베팅 광고
    "Bet365", "bet365", "free bet", "promo code", "STYVIP", "welcome package",
    "betting credit", "opening an account", "promotional code",
    // 번역된 베팅 광고
    "무료 베팅", "프로모션 코드", "계정을 개설", "환영 패키지", "베팅 크레딧",
    "행운을 시험", "적격 베팅",
  ];
  const skipPhrases = [
    // 경기 정보 반복 (영어)
    "will be played on", "will be broadcast", "takes place at", "kicks off at",
    // 경기 정보 반복 (번역)
    "에서 열린다", "에서 열립니다", "중계된다", "중계됩니다", "에 열린다", "에 열립니다",
  ];
  const lines = text.split("\n\n");
  const cleaned: string[] = [];
  for (const line of lines) {
    if (cutoffPhrases.some((p) => line.includes(p))) break;
    if (skipPhrases.some((p) => line.includes(p))) continue;
    cleaned.push(line);
  }
  return cleaned.join("\n\n").trim();
}

export async function crawlSportytrader(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanMatches = schedules.filter(
    (s) => s.date === date 
  );
  if (koreanMatches.length === 0) return [];

  console.log("  sportytrader: 분석글 목록 가져오는 중...");
  const previews = fetchPredictionsList();
  console.log(`  sportytrader: ${previews.length}개 링크 발견`);

  const articles: AnalysisArticle[] = [];

  const fetched = await pLimit(previews, 5, async (preview) => {
    const result = fetchArticle(preview.url);
    return result ? { preview, result } : null;
  });

  for (const entry of fetched) {
    if (!entry) continue;
    const { preview, result } = entry;

    const homeKo = findKoreanTeamName(result.homeTeamEn);
    const awayKo = findKoreanTeamName(result.awayTeamEn);
    if (!homeKo || !awayKo) continue;

    const matched = koreanMatches.find(
      (s) =>
        (s.homeTeam.includes(homeKo) && s.awayTeam.includes(awayKo)) ||
        (s.homeTeam.includes(awayKo) && s.awayTeam.includes(homeKo))
    );
    if (!matched) continue;

    console.log(`  ✓ ${result.homeTeamEn} vs ${result.awayTeamEn} → ${homeKo} vs ${awayKo}`);

    articles.push({
      id: `${date}-sporty-${toSlug(result.homeTeamEn)}-vs-${toSlug(result.awayTeamEn)}`,
      date,
      time: matched.time,
      sport: matched.sport,
      league: matched.league,
      homeTeam: homeKo,
      awayTeam: awayKo,
      homeTeamEn: result.homeTeamEn,
      awayTeamEn: result.awayTeamEn,
      sourceUrl: preview.url,
      prediction: result.prediction,
      content: result.content,
      crawledAt: new Date().toISOString(),
    });
  }

  console.log(`  sportytrader: ${articles.length}건 수집`);
  return articles;
}

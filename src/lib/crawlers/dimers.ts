import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findKoreanTeamName } from "@/data/team-names";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface MatchPreview {
  url: string;
  league: string;
}

// 리그 스케줄 페이지에서 경기 링크 수집
async function fetchLeagueSchedule(league: string): Promise<MatchPreview[]> {
  const res = await fetch(`https://www.dimers.com/bet-hub/${league}/schedule`, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return [];

  const html = await res.text();
  const matches: MatchPreview[] = [];
  const linkPattern = new RegExp(`href="(/bet-hub/${league}/schedule/[^"]+)"`, "g");
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const url = `https://www.dimers.com${match[1]}`;
    if (!matches.some((m) => m.url === url)) {
      matches.push({ url, league });
    }
  }
  return matches;
}

async function fetchArticle(url: string): Promise<{
  homeTeamEn: string;
  awayTeamEn: string;
  prediction: string;
  content: string;
} | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) return null;

  const html = await res.text();

  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  let homeTeamEn = "";
  let awayTeamEn = "";

  if (titleMatch) {
    const vsMatch = titleMatch[1].match(/(.+?)\s+vs\.?\s+(.+?)\s+(?:Prediction|Odds|Pick)/i);
    if (vsMatch) {
      homeTeamEn = vsMatch[1].trim();
      awayTeamEn = vsMatch[2].trim();
    }
  }
  if (!homeTeamEn || !awayTeamEn) return null;

  const paragraphs: string[] = [];
  const pPattern = new RegExp("<p[^>]*>([^<]{40,})</p>", "g");
  let pMatch;
  while ((pMatch = pPattern.exec(html)) !== null) {
    let text = pMatch[1].replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#\d+;/g, "").trim();
    if (
      !text.includes("1-800-GAMBLER") && !text.includes("responsible gambling") &&
      !text.includes("bet responsibly") && !text.includes("financial limits") &&
      !text.includes("Copyright") && !text.includes("Cipher Sports") &&
      !text.includes("referral fee") && !text.includes("promo code") &&
      !text.includes("welcome package") && !text.includes("broadcast on Sky")
    ) {
      text = text.replace(/\s*(?:Find|Check|See|Get)[^.]*?(?:spread|moneyline|odds)[^.]*\.\s*/gi, " ").trim();
      if (text) paragraphs.push(text);
    }
  }
  if (paragraphs.length === 0) return null;

  let prediction = "";
  for (const p of paragraphs) {
    if (p.includes("win probability") || p.includes("probability of")) {
      prediction = p;
      break;
    }
  }

  return { homeTeamEn, awayTeamEn, prediction, content: paragraphs.join("\n\n") };
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export async function crawlDimers(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanMatches = schedules.filter(
    (s) => s.date === date && s.koreanCommentary === true &&
      (s.sport === "축구" || s.sport === "농구" || s.sport === "야구")
  );
  if (koreanMatches.length === 0) return [];

  // 필요한 리그만 가져오기
  const needEpl = koreanMatches.some(s => s.sport === "축구");
  const needNba = koreanMatches.some(s => s.sport === "농구" && s.league === "NBA");
  const needMlb = koreanMatches.some(s => s.sport === "야구" && s.league === "MLB");

  const leagues: string[] = [];
  if (needEpl) leagues.push("epl");
  if (needNba) leagues.push("nba");
  if (needMlb) leagues.push("mlb");

  if (leagues.length === 0) return [];

  console.log(`  dimers: ${leagues.join(",")} 스케줄 가져오는 중...`);

  // 리그별 스케줄 병렬 수집
  const results = await Promise.allSettled(leagues.map(l => fetchLeagueSchedule(l)));
  const allPreviews: MatchPreview[] = [];
  results.forEach(r => { if (r.status === "fulfilled") allPreviews.push(...r.value); });

  console.log(`  dimers: ${allPreviews.length}개 링크 발견`);

  // 병렬로 개별 페이지 fetch (최대 5개씩)
  const articles: AnalysisArticle[] = [];
  const BATCH = 5;

  for (let i = 0; i < allPreviews.length; i += BATCH) {
    const batch = allPreviews.slice(i, i + BATCH);
    const batchResults = await Promise.allSettled(batch.map(p => fetchArticle(p.url)));

    for (let j = 0; j < batchResults.length; j++) {
      const r = batchResults[j];
      if (r.status !== "fulfilled" || !r.value) continue;

      const result = r.value;
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
        id: `${date}-dimers-${toSlug(result.homeTeamEn)}-vs-${toSlug(result.awayTeamEn)}`,
        date,
        time: matched.time,
        sport: matched.sport,
        league: matched.league,
        homeTeam: homeKo,
        awayTeam: awayKo,
        homeTeamEn: result.homeTeamEn,
        awayTeamEn: result.awayTeamEn,
        sourceUrl: batch[j].url,
        prediction: result.prediction,
        content: result.content,
        crawledAt: new Date().toISOString(),
      });
    }
  }

  console.log(`  dimers: ${articles.length}건 수집`);
  return articles;
}

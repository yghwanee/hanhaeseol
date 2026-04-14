import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findKoreanTeamName } from "@/data/team-names";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface MatchPreview {
  homeTeamEn: string;
  awayTeamEn: string;
  url: string;
}

// 메인 페이지에서 경기 링크 수집
async function fetchPredictionsList(): Promise<MatchPreview[]> {
  const res = await fetch("https://footballpredictions.net/", {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`  footballpredictions.net 목록: HTTP ${res.status}`);
    return [];
  }

  const html = await res.text();
  const matches: MatchPreview[] = [];

  // /팀1-v-팀2-predictions-betting-tips 패턴
  const linkPattern = /href="(https:\/\/footballpredictions\.net\/([a-z0-9-]+)-v-([a-z0-9-]+)-predictions-betting-tips)"/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const url = match[1];
    const home = match[2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const away = match[3].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    if (!matches.some((m) => m.url === url)) {
      matches.push({ homeTeamEn: home, awayTeamEn: away, url });
    }
  }

  return matches;
}

async function fetchArticle(url: string): Promise<{ prediction: string; content: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) return null;

  const html = await res.text();

  // 본문 추출: 순수 <p> 태그
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
      !text.includes("no profits are guaranteed") &&
      !text.includes("Always gamble") &&
      !text.includes("scroll down") &&
      !text.includes("betting odds")
    ) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length === 0) return null;

  let prediction = "";
  for (const p of paragraphs) {
    if (p.includes("predict") || p.includes("tip") || p.includes("expect")) {
      prediction = p;
      break;
    }
  }

  return { prediction, content: paragraphs.join("\n\n") };
}

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

export async function crawlFootballpredictionsNet(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  console.log("  footballpredictions.net: 분석글 목록 가져오는 중...");
  const previews = await fetchPredictionsList();
  console.log(`  footballpredictions.net: ${previews.length}개 경기 발견`);

  const koreanFootball = schedules.filter(
    (s) => s.date === date && s.sport === "축구" 
  );

  const articles: AnalysisArticle[] = [];

  for (const preview of previews) {
    const homeKo = findKoreanTeamName(preview.homeTeamEn);
    const awayKo = findKoreanTeamName(preview.awayTeamEn);
    if (!homeKo || !awayKo) continue;

    const matched = koreanFootball.find(
      (s) =>
        (s.homeTeam.includes(homeKo) && s.awayTeam.includes(awayKo)) ||
        (s.homeTeam.includes(awayKo) && s.awayTeam.includes(homeKo))
    );
    if (!matched) continue;

    console.log(`  ✓ ${preview.homeTeamEn} vs ${preview.awayTeamEn} → ${homeKo} vs ${awayKo}`);

    const result = await fetchArticle(preview.url);
    if (!result) continue;

    articles.push({
      id: `${date}-fpnet-${toSlug(homeKo)}-vs-${toSlug(awayKo)}`,
      date,
      time: matched.time,
      sport: matched.sport,
      league: matched.league,
      homeTeam: homeKo,
      awayTeam: awayKo,
      homeTeamEn: preview.homeTeamEn,
      awayTeamEn: preview.awayTeamEn,
      sourceUrl: preview.url,
      prediction: result.prediction,
      content: result.content,
      crawledAt: new Date().toISOString(),
    });
  }

  console.log(`  footballpredictions.net: ${articles.length}건 수집`);
  return articles;
}

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

interface MatchPreview {
  url: string;
  sportCode: string; // baseball | basketball | soccer
  dateISO: string; // YYYY-MM-DD extracted from URL slug
}

function slugDateToISO(slug: string): string | null {
  const m = slug.match(/m-(\d{2})-(\d{2})-(\d{4})-/);
  if (!m) return null;
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

function fetchPredictionsList(): MatchPreview[] {
  const html = curlFetch("https://scores24.live/en/predictions");
  if (!html) return [];

  const pattern = /href="(\/en\/(baseball|basketball|soccer)\/(m-\d{2}-\d{2}-\d{4}-[a-z0-9-]+-prediction))"/g;
  const previews: MatchPreview[] = [];
  const seen = new Set<string>();

  let match;
  while ((match = pattern.exec(html)) !== null) {
    const [, path, sport, slug] = match;
    if (seen.has(path)) continue;
    seen.add(path);
    const dateISO = slugDateToISO(slug);
    if (!dateISO) continue;
    previews.push({
      url: `https://scores24.live${path}`,
      sportCode: sport,
      dateISO,
    });
  }

  return previews;
}

function fetchArticle(url: string): {
  homeTeamEn: string;
  awayTeamEn: string;
  prediction: string;
  content: string;
} | null {
  const html = curlFetch(url);
  if (!html) return null;

  // 제목: <h1 ... data-testid="Headline">X vs Y Prediction</h1>
  const hlMatch = html.match(/data-testid="Headline"[^>]*>([^<]+)</);
  if (!hlMatch) return null;
  const headline = hlMatch[1].replace(/&amp;/g, "&").trim();
  const vsMatch = headline.match(/^(.+?)\s+vs\s+(.+?)\s+(?:Prediction|Preview)/i);
  if (!vsMatch) return null;
  const homeTeamEn = vsMatch[1].trim();
  const awayTeamEn = vsMatch[2].trim();

  // prediction 섹션: data-anchor="prediction" 이후 다음 앵커 또는 footer까지
  const predBlock = html.match(
    /data-anchor="prediction"[\s\S]*?(?=data-anchor="|<footer|<\/body>)/
  );
  if (!predBlock) return null;

  // 태그 제거 후 의미 있는 단락 추출
  const raw = predBlock[0]
    .replace(/<[^>]+>/g, "|")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#\d+;/g, "")
    .replace(/\|+/g, "|");

  const paragraphs = raw
    .split("|")
    .map((s) => s.trim())
    .filter(
      (s) =>
        s.length > 60 &&
        !s.includes("data-testid") &&
        !s.includes("PageAnchorContainer") &&
        !s.includes("bet responsibly") &&
        !s.includes("18+")
    );

  if (paragraphs.length === 0) return null;

  // prediction: 첫 번째 단락(보통 📡로 시작하는 요약)
  const prediction = paragraphs[0];
  const content = paragraphs.join("\n\n");

  return { homeTeamEn, awayTeamEn, prediction, content };
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

export async function crawlScores24(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanMatches = schedules.filter(
    (s) => s.date === date && s.koreanCommentary === true
  );
  if (koreanMatches.length === 0) return [];

  console.log("  scores24: 분석글 목록 가져오는 중...");
  const previews = fetchPredictionsList();
  // scores24 slug는 유럽 현지 날짜 기준이라 KST로는 ±1일 차이가 날 수 있음
  const prevDay = (() => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const todays = previews.filter((p) => p.dateISO === date || p.dateISO === prevDay);
  console.log(`  scores24: ${previews.length}개 링크, ${date}(±1) 기준 ${todays.length}개`);

  const articles: AnalysisArticle[] = [];

  for (let j = 0; j < todays.length; j++) {
    const p = todays[j];
    const result = fetchArticle(p.url);
    if (!result) continue;
    {
      const homeKo = findKoreanTeamName(result.homeTeamEn);
      const awayKo = findKoreanTeamName(result.awayTeamEn);
      if (!homeKo || !awayKo) continue;

      const matched = koreanMatches.find(
        (s) =>
          (s.homeTeam.includes(homeKo) && s.awayTeam.includes(awayKo)) ||
          (s.homeTeam.includes(awayKo) && s.awayTeam.includes(homeKo))
      );
      if (!matched) continue;

      console.log(
        `  ✓ ${result.homeTeamEn} vs ${result.awayTeamEn} → ${homeKo} vs ${awayKo}`
      );

      articles.push({
        id: `${date}-scores24-${toSlug(result.homeTeamEn)}-vs-${toSlug(result.awayTeamEn)}`,
        date,
        time: matched.time,
        sport: matched.sport,
        league: matched.league,
        homeTeam: homeKo,
        awayTeam: awayKo,
        homeTeamEn: result.homeTeamEn,
        awayTeamEn: result.awayTeamEn,
        sourceUrl: p.url,
        prediction: result.prediction,
        content: result.content,
        crawledAt: new Date().toISOString(),
      });
    }
  }

  console.log(`  scores24: ${articles.length}건 수집`);
  return articles;
}

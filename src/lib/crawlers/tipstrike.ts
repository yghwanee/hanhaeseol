import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findEnglishTeamName } from "@/data/team-names";

// 팀명을 URL slug로 변환: "Crystal Palace" → "crystal-palace"
function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// 개별 분석글 크롤링
async function fetchArticle(url: string): Promise<{ prediction: string; content: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(10000),
    redirect: "manual",
  });

  // 404 또는 리다이렉트면 해당 경기 분석 없음
  if (!res.ok) return null;

  const html = await res.text();

  // 실제 분석 페이지인지 확인 (팀명이 포함된 콘텐츠가 있어야 함)
  if (!html.includes("prediction") && !html.includes("Prediction")) return null;

  // 예측 추출
  let prediction = "";
  const predMatch = html.match(/(?:prediction|tip|pick)[^<]*<[^>]*>([^<]{5,})/i);
  if (predMatch) prediction = predMatch[1].trim();

  // 본문 추출: <p> 태그에서 의미 있는 텍스트
  const paragraphs: string[] = [];
  const pPattern = new RegExp("<p[^>]*>(.*?)</p>", "gs");
  let pMatch;
  while ((pMatch = pPattern.exec(html)) !== null) {
    const text = pMatch[1]
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#8217;/g, "'")
      .replace(/&#8216;/g, "'")
      .replace(/&#8211;/g, "–")
      .replace(/&#\d+;/g, "")
      .trim();
    if (
      text.length > 30 &&
      !text.includes("bet now") &&
      !text.includes("Sign up") &&
      !text.includes("cookie") &&
      !text.includes("odds") &&
      !text.includes("Bet responsibly") &&
      !text.includes("18+")
    ) {
      paragraphs.push(text);
    }
  }

  let content = paragraphs.join("\n\n");
  content = cleanContent(content);

  if (!content) return null;

  return { prediction, content };
}

function cleanContent(text: string): string {
  const cutoffPhrases = [
    "Sign Up",
    "GambleAware",
    "responsible gambling",
    "Gambling Helpline",
    "You must be 18",
    "Bet responsibly",
    "cookie",
    "Terms and Conditions",
    "Privacy Policy",
    "무료 주간",
    "도박에 대한",
    "18세 이상",
    "책임감 있게",
  ];

  const lines = text.split("\n\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    if (cutoffPhrases.some((p) => line.includes(p))) break;
    cleaned.push(line);
  }

  return cleaned.join("\n\n").trim();
}

// 한국어해설 경기 기준으로 tipstrike URL 직접 구성하여 크롤링
export async function crawlTipstrike(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanFootball = schedules.filter(
    (s) => s.date === date && s.sport === "축구" && s.koreanCommentary === true
  );
  console.log(`  tipstrike: 한국어해설 축구 ${koreanFootball.length}개 경기에서 분석글 탐색...`);

  const articles: AnalysisArticle[] = [];

  for (const schedule of koreanFootball) {
    const homeEn = findEnglishTeamName(schedule.homeTeam);
    const awayEn = findEnglishTeamName(schedule.awayTeam);

    if (!homeEn || !awayEn) continue;

    const url = `https://tipstrike.com/prediction/${toSlug(homeEn)}-vs-${toSlug(awayEn)}-betting-tips`;

    const result = await fetchArticle(url);
    if (!result) {
      // 홈/원정 반대로도 시도
      const reverseUrl = `https://tipstrike.com/prediction/${toSlug(awayEn)}-vs-${toSlug(homeEn)}-betting-tips`;
      const reverseResult = await fetchArticle(reverseUrl);
      if (!reverseResult) continue;

      console.log(`  ✓ ${homeEn} vs ${awayEn} (reverse)`);

      articles.push({
        id: `${date}-tipstrike-${toSlug(homeEn)}-vs-${toSlug(awayEn)}`,
        date,
        time: schedule.time,
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
      id: `${date}-tipstrike-${toSlug(homeEn)}-vs-${toSlug(awayEn)}`,
      date,
      time: schedule.time,
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

  console.log(`  tipstrike: ${articles.length}건 수집`);
  return articles;
}

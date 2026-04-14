import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findEnglishTeamName } from "@/data/team-names";
import { toSlug } from "./_utils";

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

  const prediction = "";

  // 본문 추출: <p> 태그에서 의미 있는 텍스트 (쿠키/광고 문구 제외)
  const skipPhrases = [
    "cookie", "Cookie", "cookies", "Cookies",
    "bet now", "Sign up", "Bet responsibly", "18+",
    "XSRF", "Google Analytics", "browsing session",
    "cross-site request forgery", "throttle the request rate",
    "consent preferences", "time zone so we can",
    "user experience", "improve the service",
    "top betting tips and predictions for the match",
    "See below all the main information",
  ];

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
      .replace(/&#039;/g, "'")
      .replace(/&#\d+;/g, "")
      .trim();
    if (
      text.length > 50 &&
      !skipPhrases.some((p) => text.includes(p))
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
    "Cookie",
    "Terms and Conditions",
    "Privacy Policy",
    "cross-site request forgery",
    "Google Analytics",
    "navigation session",
    "Here are the best betting tips",
    "무료 주간",
    "도박에 대한",
    "18세 이상",
    "책임감 있게",
    "쿠키 정책",
    "사용자 탐색 세션",
    "교차 사이트 요청 위조",
    "세션 상태를 유지",
    "요청 속도를 조절",
    "시간대를 저장",
    "최고의 베팅 팁과 예측",
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
    (s) => s.date === date && s.sport === "축구" 
  );
  console.log(`  tipstrike: 한국어해설 축구 ${koreanFootball.length}개 경기에서 분석글 탐색...`);

  const targets = koreanFootball
    .map((s) => ({ schedule: s, homeEn: findEnglishTeamName(s.homeTeam), awayEn: findEnglishTeamName(s.awayTeam) }))
    .filter((t): t is typeof t & { homeEn: string; awayEn: string } => !!t.homeEn && !!t.awayEn);

  const results = await Promise.allSettled(targets.map(async ({ schedule, homeEn, awayEn }) => {
    const url = `https://tipstrike.com/prediction/${toSlug(homeEn)}-vs-${toSlug(awayEn)}-betting-tips`;
    let result = await fetchArticle(url);
    let sourceUrl = url;
    if (!result) {
      sourceUrl = `https://tipstrike.com/prediction/${toSlug(awayEn)}-vs-${toSlug(homeEn)}-betting-tips`;
      result = await fetchArticle(sourceUrl);
    }
    if (!result) return null;
    console.log(`  ✓ ${homeEn} vs ${awayEn}`);
    return {
      id: `${date}-tipstrike-${toSlug(homeEn)}-vs-${toSlug(awayEn)}`,
      date, time: schedule.time, sport: schedule.sport, league: schedule.league,
      homeTeam: schedule.homeTeam, awayTeam: schedule.awayTeam,
      homeTeamEn: homeEn, awayTeamEn: awayEn, sourceUrl,
      prediction: result.prediction, content: result.content,
      crawledAt: new Date().toISOString(),
    };
  }));

  const articles: AnalysisArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) articles.push(r.value);
  }

  console.log(`  tipstrike: ${articles.length}건 수집`);
  return articles;
}

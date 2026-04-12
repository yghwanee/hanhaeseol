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

  if (!res.ok) return null;

  const html = await res.text();

  // 예측/팁 추출
  let prediction = "";
  const tipMatch = html.match(/(?:Our Tip|Prediction|Best Bet)[^<]*<[^>]*>([^<]+)/i);
  if (tipMatch && !tipMatch[1].includes("Select Fixture")) prediction = tipMatch[1].trim();

  // 분석 본문 추출
  let content = "";

  // __NEXT_DATA__ JSON에서 콘텐츠 추출 시도
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const pageProps = data?.props?.pageProps;

      if (pageProps?.tips) {
        const tips = pageProps.tips;
        if (Array.isArray(tips) && tips.length > 0) {
          prediction = tips.map((t: { name?: string; value?: string }) =>
            `${t.name || ""}: ${t.value || ""}`
          ).join("\n");
        }
      }

      if (pageProps?.content) {
        content = pageProps.content
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      } else if (pageProps?.preview) {
        content = pageProps.preview
          .replace(/<[^>]*>/g, "")
          .replace(/&nbsp;/g, " ")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
      }
    } catch {
      // JSON 파싱 실패
    }
  }

  // HTML에서 <p> 태그 추출
  if (!content) {
    const paragraphs: string[] = [];
    const pPattern = new RegExp("<p[^>]*>(.*?)</p>", "gs");
    let pMatch;
    while ((pMatch = pPattern.exec(html)) !== null) {
      const text = pMatch[1]
        .replace(/<[^>]*>/g, "")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .trim();
      if (text.length > 30 && !text.includes("bet now") && !text.includes("Sign up")) {
        paragraphs.push(text);
      }
    }
    content = paragraphs.join("\n\n");
  }

  content = cleanContent(content);
  if (!content) return null;

  return { prediction, content };
}

function cleanContent(text: string): string {
  const cutoffPhrases = [
    "Sign Up For", "Free Weekly Betting", "GambleAware", "responsible gambling",
    "National Gambling Helpline", "You must be 18", "Bet responsibly",
    "무료 주간 베팅", "가입하시면 당사의", "도박에 대한 책임",
    "전국 도박 상담", "18세 이상", "책임감 있게 베팅",
  ];

  const lines = text.split("\n\n");
  const cleaned: string[] = [];

  for (const line of lines) {
    if (cutoffPhrases.some((p) => line.includes(p))) break;
    if (line.includes("Select Fixture") || line.includes("설비 선택")) continue;
    cleaned.push(line);
  }

  return cleaned.join("\n\n").trim();
}

// 한국어해설 경기 기준으로 freesupertips URL 직접 구성하여 크롤링
export async function crawlFreesupertips(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanFootball = schedules.filter(
    (s) => s.date === date && s.sport === "축구" && s.koreanCommentary === true
  );
  console.log(`  freesupertips: 한국어해설 축구 ${koreanFootball.length}개 경기에서 분석글 탐색...`);

  // 매칭 가능한 경기만 사전 필터
  const targets = koreanFootball
    .map((s) => ({ schedule: s, homeEn: findEnglishTeamName(s.homeTeam), awayEn: findEnglishTeamName(s.awayTeam) }))
    .filter((t): t is typeof t & { homeEn: string; awayEn: string } => !!t.homeEn && !!t.awayEn);

  // 병렬 fetch
  const results = await Promise.allSettled(targets.map(async ({ schedule, homeEn, awayEn }) => {
    const url = `https://www.freesupertips.com/predictions/${toSlug(homeEn)}-vs-${toSlug(awayEn)}-predictions-betting-tips-match-previews/`;
    let result = await fetchArticle(url);
    let sourceUrl = url;
    if (!result) {
      sourceUrl = `https://www.freesupertips.com/predictions/${toSlug(awayEn)}-vs-${toSlug(homeEn)}-predictions-betting-tips-match-previews/`;
      result = await fetchArticle(sourceUrl);
    }
    if (!result) return null;
    console.log(`  ✓ ${homeEn} vs ${awayEn}`);
    return {
      id: `${date}-fst-${toSlug(homeEn)}-vs-${toSlug(awayEn)}`,
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

  console.log(`  freesupertips: ${articles.length}건 수집`);
  return articles;
}

import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findKoreanTeamName, LEAGUE_NAME_MAP } from "@/data/team-names";
import { translateToKorean } from "@/lib/translate";

interface MatchPreview {
  homeTeamEn: string;
  awayTeamEn: string;
  league: string;
  url: string;
}

// 예측 목록 페이지에서 경기 정보 추출
async function fetchPredictionsList(): Promise<MatchPreview[]> {
  const res = await fetch("https://www.freesupertips.com/predictions/", {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`freesupertips 목록: HTTP ${res.status}`);
    return [];
  }

  const html = await res.text();
  const matches: MatchPreview[] = [];

  // 경기 링크 패턴: /predictions/team1-vs-team2-predictions-...
  const linkPattern = /href="(\/predictions\/([^"]+?)-vs-([^"]+?)-predictions[^"]*)"/g;
  let match;

  while ((match = linkPattern.exec(html)) !== null) {
    const url = `https://www.freesupertips.com${match[1]}`;
    // URL에서 팀명 추출 (kebab-case → Title Case)
    const home = match[2].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
    const away = match[3].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

    // 중복 제거
    if (!matches.some((m) => m.url === url)) {
      matches.push({ homeTeamEn: home, awayTeamEn: away, league: "", url });
    }
  }

  // 리그 정보 추출 시도 (HTML에서 리그명 찾기)
  for (const m of matches) {
    for (const [enLeague] of Object.entries(LEAGUE_NAME_MAP)) {
      const leagueLower = enLeague.toLowerCase();
      // URL 근처에서 리그명 찾기
      const idx = html.indexOf(m.url.replace("https://www.freesupertips.com", ""));
      if (idx >= 0) {
        const context = html.slice(Math.max(0, idx - 500), idx + 500).toLowerCase();
        if (context.includes(leagueLower) || context.includes(leagueLower.replace(/ /g, "-"))) {
          m.league = enLeague;
          break;
        }
      }
    }
  }

  return matches;
}

// 개별 분석글 크롤링
async function fetchArticle(url: string): Promise<{ prediction: string; content: string }> {
  const res = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    console.error(`분석글 크롤링 실패: ${url} (${res.status})`);
    return { prediction: "", content: "" };
  }

  const html = await res.text();

  // 예측/팁 추출
  let prediction = "";
  const tipMatch = html.match(/(?:Our Tip|Prediction|Best Bet)[^<]*<[^>]*>([^<]+)/i);
  if (tipMatch && !tipMatch[1].includes("Select Fixture")) prediction = tipMatch[1].trim();

  // 분석 본문 추출 (article/main content 영역에서 <p> 태그 내용)
  let content = "";

  // __NEXT_DATA__ JSON에서 콘텐츠 추출 시도
  const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>(.+?)<\/script>/);
  if (nextDataMatch) {
    try {
      const data = JSON.parse(nextDataMatch[1]);
      const pageProps = data?.props?.pageProps;

      // prediction 추출
      if (pageProps?.tips) {
        const tips = pageProps.tips;
        if (Array.isArray(tips) && tips.length > 0) {
          prediction = tips.map((t: { name?: string; value?: string }) =>
            `${t.name || ""}: ${t.value || ""}`
          ).join("\n");
        }
      }

      // content 추출
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
      // JSON 파싱 실패 시 HTML에서 직접 추출
    }
  }

  // __NEXT_DATA__에서 못 찾으면 HTML에서 <p> 태그 추출
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
      // 의미 있는 텍스트만 (광고, 베팅 관련 제외)
      if (text.length > 30 && !text.includes("bet now") && !text.includes("Sign up")) {
        paragraphs.push(text);
      }
    }
    content = paragraphs.join("\n\n");
  }

  // 광고/도박 관련 텍스트 제거
  content = cleanContent(content);

  return { prediction, content };
}

// 광고, 베팅 권유, 도박 경고 등 불필요한 텍스트 제거
function cleanContent(text: string): string {
  const cutoffPhrases = [
    "Sign Up For",
    "Free Weekly Betting",
    "GambleAware",
    "responsible gambling",
    "National Gambling Helpline",
    "You must be 18",
    "Bet responsibly",
    "무료 주간 베팅",
    "가입하시면 당사의",
    "도박에 대한 책임",
    "전국 도박 상담",
    "18세 이상",
    "책임감 있게 베팅",
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

// 스케줄과 매칭하여 분석글 크롤링
export async function crawlFreesupertips(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  console.log("  freesupertips: 예측 목록 가져오는 중...");
  const previews = await fetchPredictionsList();
  console.log(`  freesupertips: ${previews.length}개 경기 발견`);

  // 오늘 한국어해설 축구 경기만 필터
  const koreanFootball = schedules.filter(
    (s) => s.date === date && s.sport === "축구" && s.koreanCommentary === true
  );
  console.log(`  한국어해설 축구 경기: ${koreanFootball.length}개`);

  const articles: AnalysisArticle[] = [];

  for (const preview of previews) {
    const homeKo = findKoreanTeamName(preview.homeTeamEn);
    const awayKo = findKoreanTeamName(preview.awayTeamEn);

    if (!homeKo || !awayKo) continue;

    // schedule.json에서 매칭 (홈/원정 순서 무관)
    const matched = koreanFootball.find(
      (s) =>
        (s.homeTeam.includes(homeKo) && s.awayTeam.includes(awayKo)) ||
        (s.homeTeam.includes(awayKo) && s.awayTeam.includes(homeKo))
    );

    if (!matched) continue;

    console.log(`  매칭: ${preview.homeTeamEn} vs ${preview.awayTeamEn} → ${homeKo} vs ${awayKo}`);

    // 분석글 크롤링
    const { prediction, content } = await fetchArticle(preview.url);
    if (!content) {
      console.log(`  ⚠ 분석 내용 없음: ${preview.url}`);
      continue;
    }

    // 번역
    console.log(`  번역 중: ${homeKo} vs ${awayKo}...`);
    const translatedPrediction = prediction ? await translateToKorean(prediction) : "";
    const translatedContent = await translateToKorean(content);

    const leagueKo = preview.league
      ? LEAGUE_NAME_MAP[preview.league] || matched.league
      : matched.league;

    articles.push({
      id: `${date}-${preview.homeTeamEn.toLowerCase().replace(/\s+/g, "-")}-vs-${preview.awayTeamEn.toLowerCase().replace(/\s+/g, "-")}`,
      date,
      league: leagueKo,
      homeTeam: homeKo,
      awayTeam: awayKo,
      homeTeamEn: preview.homeTeamEn,
      awayTeamEn: preview.awayTeamEn,
      sourceUrl: preview.url,
      prediction: translatedPrediction,
      content: translatedContent,
      crawledAt: new Date().toISOString(),
    });
  }

  return articles;
}

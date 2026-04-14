import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";
import { findEnglishTeamName } from "@/data/team-names";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

// schedule.json 리그명 → footballpredictions.com URL 경로
const LEAGUE_PATH: Record<string, string> = {
  "프리미어리그": "premierleaguepredictions",
  "라리가": "primeradivisionpredictions",
  "세리에A": "serieapredictions",
  "분데스리가": "bundesligapredictions",
  "리그 1": "ligue-1-predictions",
  "리그1": "ligue-1-predictions",
  "챔피언스리그": "championsleaguepredictions",
  "유로파리그": "europaleaguepredictions",
  "컨퍼런스리그": "europa-conference-league-predictions",
  "EFL 챔피언십": "championshippredictions",
};

function toSlug(name: string): string {
  return name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
}

// 날짜를 DD-MM-YYYY로 변환
function toDateSlug(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}-${m}-${y}`;
}

async function fetchArticle(url: string): Promise<{ prediction: string; content: string } | null> {
  const res = await fetch(url, {
    headers: { "User-Agent": UA },
    signal: AbortSignal.timeout(10000),
    redirect: "manual",
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
      .replace(/&#\d+;/g, "")
      .trim();
    if (
      !text.includes("bookmaker") &&
      !text.includes("place your bets") &&
      !text.includes("You can place") &&
      !text.includes("18+")
    ) {
      paragraphs.push(text);
    }
  }

  if (paragraphs.length === 0) return null;

  return { prediction: "", content: paragraphs.join("\n\n") };
}

export async function crawlFootballpredictions(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanFootball = schedules.filter(
    (s) => s.date === date && s.sport === "축구" 
  );
  console.log(`  footballpredictions: 축구 ${koreanFootball.length}개 경기에서 분석글 탐색...`);

  // fp.com은 UK/유럽 현지 날짜 기준 (대부분 저녁 경기 = KST 다음날). 원 date와 -1일 둘 다 시도.
  const prevDate = (() => {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const dateSlugs = [toDateSlug(date), toDateSlug(prevDate)];

  const targets = koreanFootball
    .map((s) => ({ schedule: s, leaguePath: LEAGUE_PATH[s.league], homeEn: findEnglishTeamName(s.homeTeam), awayEn: findEnglishTeamName(s.awayTeam) }))
    .filter((t): t is typeof t & { leaguePath: string; homeEn: string; awayEn: string } => !!t.leaguePath && !!t.homeEn && !!t.awayEn);

  const results = await Promise.allSettled(targets.map(async ({ schedule, leaguePath, homeEn, awayEn }) => {
    let result: Awaited<ReturnType<typeof fetchArticle>> = null;
    let sourceUrl = "";
    for (const ds of dateSlugs) {
      for (const [a, b] of [[homeEn, awayEn], [awayEn, homeEn]]) {
        const url = `https://footballpredictions.com/footballpredictions/${leaguePath}/${toSlug(a)}-vs-${toSlug(b)}-prediction-${ds}/`;
        const r = await fetchArticle(url);
        if (r) { result = r; sourceUrl = url; break; }
      }
      if (result) break;
    }
    if (!result) return null;
    console.log(`  ✓ ${homeEn} vs ${awayEn}`);
    return {
      id: `${date}-fp-${toSlug(homeEn)}-vs-${toSlug(awayEn)}`,
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

  console.log(`  footballpredictions: ${articles.length}건 수집`);
  return articles;
}

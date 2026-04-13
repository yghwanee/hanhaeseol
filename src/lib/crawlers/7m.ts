import { AnalysisArticle } from "@/types/analysis";
import { Schedule } from "@/types/schedule";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

interface Game7M {
  GameId: string;
  StartTime: string; // "2026,04,12,23,15,00" or "2026-04-12 23:15:00"
  CompetitionName: string;
  HomeName: string;
  AwayName: string;
  PredictionDesc: string;
}

interface GameEvent7M {
  HomeAway: string; // "0" = 홈팀, "1" = 원정팀
  Title: string;
  UpDown: string; // "0" = 호재, "1" = 악재
}

// JS 변수 할당 형식 파싱: var game = {...}; var gameEvent = [...]
function parseJsVars(text: string): { game: Game7M; gameEvent: GameEvent7M[] } | null {
  try {
    const gameMatch = text.match(/var\s+game\s*=\s*(\{[\s\S]*?\});/);
    const eventMatch = text.match(/var\s+gameEvent\s*=\s*(\[[\s\S]*?\]);/);
    if (!gameMatch) return null;

    const game: Game7M = JSON.parse(gameMatch[1]);
    const gameEvent: GameEvent7M[] = eventMatch ? JSON.parse(eventMatch[1]) : [];
    return { game, gameEvent };
  } catch {
    return null;
  }
}

// 팀명 정규화 (접미사/접두사 제거 + 공백 통일)
function normalizeTeamName(name: string): string {
  return name
    .replace(/\s*(FC|AFC|SC|CF|AC|SV|RC|SSC|CFC|BV|UD|SG|OSC|1909|1913|1907|1895|1899)$/gi, "")
    .replace(/^(FC|AC|SC|RC|SV|SSC|OGC|RCD|CA|VfB|TSG|ACF|SS|US|1\.)\s*/gi, "")
    .replace(/\s+/g, "")  // 공백 모두 제거 (인터밀란 vs 인터 밀란)
    .trim();
}

// 축약 팀명 매핑 (schedule.json 축약명 → 7M 풀네임에 포함되는 키워드)
const SHORT_NAME_MAP: Record<string, string[]> = {
  "맨시티": ["맨체스터 시티", "맨체스터시티"],
  "맨유": ["맨체스터 유나이티드", "맨체스터유나이티드"],
  "뉴캐슬": ["뉴캐슬 유나이티드", "뉴캐슬유나이티드"],
  "노팅엄": ["노팅엄 포리스트", "노팅엄포리스트"],
  "울버햄튼": ["울버햄프턴", "울버햄튼"],
  "레버쿠젠": ["바이어 레버쿠젠", "레버쿠젠"],
  "도르트문트": ["보루시아 도르트문트", "도르트문트"],
  "프랑크푸르트": ["아인트라흐트 프랑크푸르트", "프랑크푸르트"],
  "라이프치히": ["RB 라이프치히", "라이프치히"],
};

// schedule.json 팀명과 7M 팀명 매칭
function matchTeam(scheduleName: string, sevenMName: string): boolean {
  // 축약명 매핑 확인
  const mappedNames = SHORT_NAME_MAP[scheduleName];
  if (mappedNames) {
    for (const mapped of mappedNames) {
      if (sevenMName.includes(mapped) || mapped.includes(sevenMName)) return true;
    }
  }

  const a = normalizeTeamName(scheduleName);
  const b = normalizeTeamName(sevenMName);
  return a.includes(b) || b.includes(a) || a === b;
}

// 이벤트를 분석 본문으로 변환
function formatContent(game: Game7M, events: GameEvent7M[]): string {
  const parts: string[] = [];

  // 분석 요약
  if (game.PredictionDesc) {
    parts.push(game.PredictionDesc);
  }

  // 홈팀 이벤트
  const homeEvents = events.filter((e) => e.HomeAway === "0");
  if (homeEvents.length > 0) {
    parts.push(`[${game.HomeName}]`);
    for (const e of homeEvents) {
      const icon = e.UpDown === "0" ? "▲" : "▼";
      parts.push(`${icon} ${e.Title}`);
    }
  }

  // 원정팀 이벤트
  const awayEvents = events.filter((e) => e.HomeAway === "1");
  if (awayEvents.length > 0) {
    parts.push(`[${game.AwayName}]`);
    for (const e of awayEvents) {
      const icon = e.UpDown === "0" ? "▲" : "▼";
      parts.push(`${icon} ${e.Title}`);
    }
  }

  return parts.join("\n\n");
}

export async function crawl7M(
  date: string,
  schedules: Schedule[]
): Promise<AnalysisArticle[]> {
  const koreanFootball = schedules.filter(
    (s) => s.date === date && s.sport === "축구" && s.koreanCommentary === true
  );
  if (koreanFootball.length === 0) return [];

  // 날짜별 경기 목록 가져오기
  const listUrl = `https://sport.7mkr2.com/soccer/report/list/${date}.js`;
  let listText: string;
  try {
    const res = await fetch(listUrl, {
      headers: { "User-Agent": UA },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) {
      console.error(`  7M: 목록 HTTP ${res.status}`);
      return [];
    }
    listText = await res.text();
  } catch {
    console.error("  7M: 목록 요청 실패");
    return [];
  }

  // var report_list = [...] 파싱
  const listMatch = listText.match(/var\s+report_list\s*=\s*(\[[\s\S]*?\]);?$/);
  if (!listMatch) return [];

  let gameList: { GameId: string; HomeName: string; AwayName: string }[];
  try {
    gameList = JSON.parse(listMatch[1]);
  } catch {
    return [];
  }

  console.log(`  7M: ${gameList.length}개 경기 발견, 한국어해설 축구 ${koreanFootball.length}개와 매칭 중...`);

  // schedule.json의 한국어해설 축구 경기와 매칭
  const matched: { schedule: Schedule; gameId: string }[] = [];
  for (const s of koreanFootball) {
    const found = gameList.find(
      (g) =>
        (matchTeam(s.homeTeam, g.HomeName) && matchTeam(s.awayTeam, g.AwayName)) ||
        (matchTeam(s.homeTeam, g.AwayName) && matchTeam(s.awayTeam, g.HomeName))
    );
    if (found) {
      matched.push({ schedule: s, gameId: found.GameId });
    }
  }

  if (matched.length === 0) return [];

  // 매칭된 경기 상세 데이터 가져오기
  const results = await Promise.allSettled(
    matched.map(async ({ schedule, gameId }) => {
      const detailUrl = `https://sport.7mkr2.com/soccer/report/data/${gameId}.js`;
      const res = await fetch(detailUrl, {
        headers: { "User-Agent": UA },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) return null;

      const text = await res.text();
      const parsed = parseJsVars(text);
      if (!parsed) return null;

      const content = formatContent(parsed.game, parsed.gameEvent);
      if (!content) return null;

      console.log(`  ✓ ${parsed.game.HomeName} vs ${parsed.game.AwayName}`);

      return {
        id: `${date}-7m-${gameId}`,
        date,
        time: schedule.time,
        sport: schedule.sport,
        league: schedule.league,
        homeTeam: schedule.homeTeam,
        awayTeam: schedule.awayTeam,
        homeTeamEn: "",
        awayTeamEn: "",
        sourceUrl: `https://www.7mkr2.com/sport/soccer/report/data/${gameId}`,
        prediction: "",
        content,
        crawledAt: new Date().toISOString(),
      } as AnalysisArticle;
    })
  );

  const articles: AnalysisArticle[] = [];
  for (const r of results) {
    if (r.status === "fulfilled" && r.value) articles.push(r.value);
  }

  console.log(`  7M: ${articles.length}건 수집`);
  return articles;
}

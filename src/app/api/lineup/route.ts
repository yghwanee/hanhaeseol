// 네이버 경기 라인업 프록시. gameId로 선발 라인업(포메이션+선발 XI)을 가져와 정규화.
// 라인업은 킥오프 ~1시간 전 확정 후 교체 외엔 거의 안 바뀌므로 길게 캐시.
const BASE = "https://api-gw.sports.naver.com";
const HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

export const dynamic = "force-dynamic";

interface NaverLineupPlayer {
  name?: string;
  pos?: string;
  shirtNumber?: number | string | null;
  goal?: string;
  yellowRedCard?: string;
  substitute?: string;
}
interface NaverTeamLineup {
  formation?: string;
  players?: { lineup?: NaverLineupPlayer[][] };
}
interface NaverLineupResult {
  lineUpData?: { lineup?: { home?: NaverTeamLineup; away?: NaverTeamLineup } };
}
interface NaverApiResponse<T> {
  success?: boolean;
  result?: T;
}

interface LineupPlayer {
  name: string;
  pos: string;
  number: number | null;
  goal: number;
  card: number; // 0=없음, 1=경고, 2=퇴장
}
interface TeamLineup {
  formation: string;
  /** 포메이션 라인별 선수(앞열=GK). 그대로 그리면 포메이션 모양이 된다. */
  lines: LineupPlayer[][];
}

function normalizeTeam(t: NaverTeamLineup | undefined): TeamLineup | null {
  const rows = t?.players?.lineup;
  if (!rows || rows.length === 0) return null;
  const lines: LineupPlayer[][] = rows.map((row) =>
    (row ?? [])
      .filter((p) => p.name)
      .map((p) => ({
        name: p.name!,
        pos: p.pos ?? "",
        number:
          p.shirtNumber === null || p.shirtNumber === undefined || p.shirtNumber === ""
            ? null
            : Number(p.shirtNumber),
        goal: Number(p.goal ?? 0) || 0,
        card: Number(p.yellowRedCard ?? 0) || 0,
      })),
  );
  const total = lines.reduce((n, l) => n + l.length, 0);
  if (total === 0) return null;
  // 네이버는 원정팀 라인을 미러링(GK가 마지막 줄)해서 준다. GK가 항상 첫 줄 오도록
  // 보정 → 홈/원정 모두 GK→공격수 순으로 일관 표시.
  const gkFirst = lines[0]?.some((p) => p.pos === "GK");
  const gkLast = lines[lines.length - 1]?.some((p) => p.pos === "GK");
  if (!gkFirst && gkLast) lines.reverse();
  return { formation: t?.formation ?? "", lines };
}

export async function GET(request: Request): Promise<Response> {
  const gameId = new URL(request.url).searchParams.get("gameId");
  // gameId는 네이버 내부 ID(영숫자). 형식 검증으로 SSRF/오작동 방지.
  if (!gameId || !/^[A-Za-z0-9]+$/.test(gameId)) {
    return new Response(JSON.stringify({ home: null, away: null }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(`${BASE}/schedule/games/${gameId}/lineup`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
      // Next.js Data Cache 가 붙잡으면 라인업 미발표 상태가 고정된다.
      // 신선도는 아래 s-maxage(엣지 캐시)로만 제어한다. /api/live 와 동일 사유.
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Naver HTTP ${res.status}`);
    const json = (await res.json()) as NaverApiResponse<NaverLineupResult>;
    const lu = json.result?.lineUpData?.lineup;
    const body = {
      home: normalizeTeam(lu?.home),
      away: normalizeTeam(lu?.away),
    };
    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response(JSON.stringify({ home: null, away: null }), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=30",
      },
    });
  }
}

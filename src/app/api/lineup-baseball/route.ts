// 네이버 야구 라인업(타순+선발투수) 프록시. KBO와 MLB의 preview 구조가 서로 달라
// 각각 파싱해 공통 형태로 정규화한다. gameId로 식별, 페이지 진입 시 클라가 호출.
const BASE = "https://api-gw.sports.naver.com";
const HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

export const dynamic = "force-dynamic";

interface BaseballBatter {
  order: number;
  name: string;
  position: string;
  backnum: string | null;
  bats: string; // 좌타/우타/양타 등 (없으면 "")
}
interface BaseballTeamLineup {
  starter: { name: string; backnum: string | null } | null;
  batters: BaseballBatter[];
}

// hitType "우투좌타" → 타격 "좌타" 추출.
function batsOf(hitType: unknown): string {
  const m = String(hitType ?? "").match(/[좌우양][타]/);
  return m ? m[0] : "";
}

// KBO: previewData.{home,away}TeamLineUp.fullLineUp[] (선발투수 1 + 타자 9, batorder로 구분)
interface KboPlayer {
  playerName?: string;
  positionName?: string;
  backnum?: string;
  batorder?: number;
  hitType?: string;
}
function parseKbo(team: { fullLineUp?: KboPlayer[] } | undefined): BaseballTeamLineup | null {
  const list = team?.fullLineUp;
  if (!Array.isArray(list) || list.length === 0) return null;
  const pitcher = list.find((p) => p.positionName === "선발투수" || (!p.batorder && /투수/.test(p.positionName ?? "")));
  const batters = list
    .filter((p) => typeof p.batorder === "number" && p.batorder > 0 && p.playerName)
    .sort((a, b) => (a.batorder ?? 0) - (b.batorder ?? 0))
    .map((p) => ({
      order: p.batorder!,
      name: p.playerName!,
      position: p.positionName ?? "",
      backnum: p.backnum ?? null,
      bats: batsOf(p.hitType),
    }));
  if (batters.length === 0 && !pitcher) return null;
  return {
    starter: pitcher?.playerName ? { name: pitcher.playerName, backnum: pitcher.backnum ?? null } : null,
    batters,
  };
}

// MLB: previewData.{home,away}TeamLineUp.{batter[], pitcher[]} (seqno===1 = 선발)
interface MlbBatter {
  name?: string;
  firstName?: string;
  posName?: string;
  backnum?: string;
  batOrder?: number;
  seqno?: number;
  hitType?: string;
}
function parseMlb(
  team: { batter?: MlbBatter[]; pitcher?: MlbBatter[] } | undefined,
): BaseballTeamLineup | null {
  const bats = team?.batter;
  if (!Array.isArray(bats) || bats.length === 0) return null;
  const seen = new Set<number>();
  const batters = bats
    .filter((b) => typeof b.batOrder === "number" && b.batOrder > 0 && (b.seqno ?? 1) === 1 && b.name)
    .filter((b) => (seen.has(b.batOrder!) ? false : (seen.add(b.batOrder!), true)))
    .sort((a, b) => (a.batOrder ?? 0) - (b.batOrder ?? 0))
    .map((b) => ({
      order: b.batOrder!,
      name: b.name!,
      position: b.posName ?? "",
      backnum: b.backnum ?? null,
      bats: batsOf(b.hitType),
    }));
  const sp = (team?.pitcher ?? []).find((p) => (p.seqno ?? 1) === 1) ?? team?.pitcher?.[0];
  if (batters.length === 0 && !sp) return null;
  return {
    starter: sp?.name ? { name: sp.name, backnum: sp.backnum ?? null } : null,
    batters,
  };
}

interface PreviewData {
  homeTeamLineUp?: unknown;
  awayTeamLineUp?: unknown;
}
interface ApiResponse {
  result?: { previewData?: PreviewData };
}

function normalize(team: unknown): BaseballTeamLineup | null {
  if (!team || typeof team !== "object") return null;
  // 구조로 KBO/MLB 자동 판별.
  if ("fullLineUp" in team) return parseKbo(team as { fullLineUp?: KboPlayer[] });
  if ("batter" in team) return parseMlb(team as { batter?: MlbBatter[]; pitcher?: MlbBatter[] });
  return null;
}

export async function GET(request: Request): Promise<Response> {
  const gameId = new URL(request.url).searchParams.get("gameId");
  if (!gameId || !/^[A-Za-z0-9]+$/.test(gameId)) {
    return new Response(JSON.stringify({ home: null, away: null }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  try {
    const res = await fetch(`${BASE}/schedule/games/${gameId}/preview`, {
      headers: HEADERS,
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(`Naver HTTP ${res.status}`);
    const json = (await res.json()) as ApiResponse;
    const pd = json.result?.previewData;
    const body = {
      home: normalize(pd?.homeTeamLineUp),
      away: normalize(pd?.awayTeamLineUp),
    };
    return new Response(JSON.stringify(body), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=120, stale-while-revalidate=600",
      },
    });
  } catch {
    return new Response(JSON.stringify({ home: null, away: null }), {
      headers: { "Content-Type": "application/json", "Cache-Control": "public, s-maxage=30" },
    });
  }
}

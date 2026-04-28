import { TeamRecord } from "@/types/team-record";

// ESPN team abbreviation → schedule.json의 한국어 팀명.
// 네이버 NBA 응답이 정규시즌 종료 후 비어있어서, 플레이오프 기간엔 ESPN을 쓴다.
const ESPN_NBA_TEAMS: Array<{ slug: string; ko: string }> = [
  { slug: "atl", ko: "애틀랜타" },
  { slug: "bos", ko: "보스턴" },
  { slug: "bkn", ko: "브루클린" },
  { slug: "cha", ko: "샬럿" },
  { slug: "chi", ko: "시카고" },
  { slug: "cle", ko: "클리블랜드" },
  { slug: "dal", ko: "댈러스" },
  { slug: "den", ko: "덴버" },
  { slug: "det", ko: "디트로이트" },
  { slug: "gs", ko: "골든스테이트" },
  { slug: "hou", ko: "휴스턴" },
  { slug: "ind", ko: "인디애나" },
  { slug: "lac", ko: "LA 클리퍼스" },
  { slug: "lal", ko: "LA 레이커스" },
  { slug: "mem", ko: "멤피스" },
  { slug: "mia", ko: "마이애미" },
  { slug: "mil", ko: "밀워키" },
  { slug: "min", ko: "미네소타" },
  { slug: "no", ko: "뉴올리언스" },
  { slug: "ny", ko: "뉴욕" },
  { slug: "okc", ko: "오클라호마시티" },
  { slug: "orl", ko: "올랜도" },
  { slug: "phi", ko: "필라델피아" },
  { slug: "phx", ko: "피닉스" },
  { slug: "por", ko: "포틀랜드" },
  { slug: "sac", ko: "새크라멘토" },
  { slug: "sas", ko: "샌안토니오" },
  { slug: "tor", ko: "토론토" },
  { slug: "utah", ko: "유타" },
  { slug: "wsh", ko: "워싱턴" },
];

interface EspnEvent {
  date: string;
  competitions: Array<{
    status?: { type?: { completed?: boolean } };
    competitors: Array<{
      homeAway: "home" | "away";
      winner?: boolean;
      team: { abbreviation: string };
      record?: Array<{ type: string; displayValue: string }>;
    }>;
  }>;
}

interface EspnScheduleResponse {
  events?: EspnEvent[];
  team?: { abbreviation?: string };
}

async function fetchTeamSchedule(slug: string): Promise<EspnScheduleResponse> {
  // seasontype 미지정 → ESPN이 현재 시즌 타입(정규/플레이오프)을 자동 선택.
  const url = `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/${slug}/schedule`;
  const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) throw new Error(`ESPN ${slug} HTTP ${res.status}`);
  return (await res.json()) as EspnScheduleResponse;
}

function extractTeamRecord(events: EspnEvent[], teamAbbr: string): TeamRecord {
  // URL slug과 응답의 abbreviation이 다른 경우가 있어(sas vs SA) 응답 abbreviation 사용.
  const upper = teamAbbr.toUpperCase();
  // 완료된 경기만, 시간순 정렬
  const completed = events
    .filter((e) => e.competitions[0]?.status?.type?.completed)
    .sort((a, b) => a.date.localeCompare(b.date));

  // 마지막 5경기 W/L 추출 (오래된→최근 순서로 저장 — 네이버 응답과 동일하게)
  const last5 = completed
    .slice(-5)
    .map((e) => {
      const comp = e.competitions[0];
      const me = comp.competitors.find((c) => c.team.abbreviation === upper);
      if (!me) return "-";
      return me.winner ? "W" : "L";
    })
    .join("");

  // 누적 W-L: 가장 최근 경기의 record.total 사용
  let win = 0;
  let lose = 0;
  let wra: number | undefined;
  const last = completed[completed.length - 1];
  if (last) {
    const me = last.competitions[0].competitors.find(
      (c) => c.team.abbreviation === upper,
    );
    const total = me?.record?.find((r) => r.type === "total")?.displayValue;
    if (total) {
      const m = total.match(/^(\d+)-(\d+)/);
      if (m) {
        win = Number(m[1]);
        lose = Number(m[2]);
        const total_ = win + lose;
        if (total_ > 0) wra = win / total_;
      }
    }
  }
  return { last5, win, lose, ...(wra !== undefined ? { wra } : {}) };
}

async function pLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let idx = 0;
  async function worker() {
    while (true) {
      const i = idx++;
      if (i >= items.length) return;
      results[i] = await fn(items[i]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function fetchEspnNbaRecords(): Promise<Record<string, TeamRecord>> {
  const out: Record<string, TeamRecord> = {};
  await pLimit(ESPN_NBA_TEAMS, 5, async ({ slug, ko }) => {
    try {
      const json = await fetchTeamSchedule(slug);
      const abbr = json.team?.abbreviation;
      if (!abbr) return;
      const record = extractTeamRecord(json.events ?? [], abbr);
      // last5가 비어있거나 모두 '-'면 (플레이오프 미진출) 등록하지 않는다.
      if (!record.last5 || /^-+$/.test(record.last5)) return;
      out[ko] = record;
    } catch (e) {
      console.error(`ESPN NBA ${slug}(${ko}) 실패:`, (e as Error).message);
    }
  });
  return out;
}

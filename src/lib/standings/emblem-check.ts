import type { StandingsData } from "@/types/standings";

/**
 * 네이버가 준 앰블럼 URL 중 **업스트림이 404 인 것만** 골라 `null` 로 떨군다.
 *
 * 배경(2026-08-24): Vercel Observability 에서 `/api/emblem` 에러율 11.8%(7일 5K 호출)가
 * 잡혔다. 앰블럼 URL 272개를 전수로 찍어 보니 **7개가 pstatic 에서 404** 였고 전부
 * K리그2 였다(김포·충북청주·천안·화성·파주·김해·용인). 프록시는 규격대로 502 를
 * 돌려주고 있었으므로 **우리 코드 버그가 아니라 네이버의 죽은 링크**다.
 *
 * `naver.ts` 는 `teamLogo: t.teamEmblemUrl ?? null` 로 응답을 그대로 저장한다. 죽은 URL 이
 * 그대로 들어가면 화면에서 **깨진 이미지 아이콘**이 뜬다 — `SoccerTable` 등은
 * `t.teamLogo ? <Image> : <회색 원>` 이라, `null` 이어야 깔끔한 플레이스홀더가 나온다.
 *
 * 🔴 **404 일 때만 지운다.** 타임아웃·네트워크 오류·5xx 는 건드리지 않는다. pstatic 이
 * 잠깐 흔들렸다고 멀쩡한 로고를 전부 날리면 크롤 한 번에 화면이 통째로 비어 버린다.
 * "확실히 없다"는 신호는 404 하나뿐이다.
 *
 * 경로 패턴으로는 거를 수 없다 — `/default/` 는 죽은 링크 표시가 아니라 네이버의 경로
 * 관례라서 272개 **전부**에 들어 있다(실측).
 *
 * 매 크롤마다 다시 확인하므로, 네이버가 나중에 로고를 채우면 **자동으로 복구된다.**
 */

/** 동시 요청 수. pstatic 에 부담 주지 않으면서 272건을 몇 초에 끝내는 선. */
const CONCURRENCY = 8;
/** 다른 네이버 fetch 와 같은 8초. */
const TIMEOUT_MS = 8000;

/** 죽은 URL 하나를 판정한다. **404 면 true**, 그 외(성공·오류·타임아웃)는 전부 false. */
async function isDead(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (haeseol emblem check)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.status === 404;
  } catch {
    // 타임아웃·네트워크 오류는 "모른다"이지 "없다"가 아니다. 살려 둔다.
    return false;
  }
}

/** StandingsData 안의 모든 팀 행을 종목 구분 없이 훑는다. */
function allTeams(data: StandingsData): { teamLogo: string | null }[] {
  return [
    ...data.soccer.flatMap((l) => l.teams),
    ...data.baseball.flatMap((l) => l.teams),
    ...data.basketball.flatMap((l) => l.teams),
  ];
}

export interface PruneResult {
  /** 확인한 고유 URL 수 */
  checked: number;
  /** 404 로 판정돼 지워진 고유 URL */
  dead: string[];
  /** 실제로 `null` 로 바뀐 팀 행 수(같은 URL 을 여러 팀이 쓸 수 있다) */
  cleared: number;
}

/**
 * `data` 를 **제자리에서** 고친다. 죽은 URL 을 쓰는 팀의 `teamLogo` 를 `null` 로 바꾼다.
 */
export async function pruneDeadEmblems(
  data: StandingsData,
  check: (url: string) => Promise<boolean> = isDead,
): Promise<PruneResult> {
  const teams = allTeams(data);
  const urls = [...new Set(teams.map((t) => t.teamLogo).filter((u): u is string => !!u))];

  const dead = new Set<string>();
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const batch = urls.slice(i, i + CONCURRENCY);
    const flags = await Promise.all(batch.map((u) => check(u)));
    batch.forEach((u, j) => {
      if (flags[j]) dead.add(u);
    });
  }

  let cleared = 0;
  for (const t of teams) {
    if (t.teamLogo && dead.has(t.teamLogo)) {
      t.teamLogo = null;
      cleared += 1;
    }
  }

  return { checked: urls.length, dead: [...dead], cleared };
}

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

/**
 * 죽은 URL 을 **되살릴 대체 경로**.
 *
 * 2026-09-03 실측: K리그2 의 죽은 7개(화성 39·김포 36·충북청주 37·천안 38·파주 40·김해 41·
 * 용인 42)는 파일이 없어진 게 아니라 **디렉터리만 다르다**. `.../team/kleague2/default/39.png`
 * 는 404 지만 `.../team/kleague/default/39.png` 는 200 이고, 받아 보면 실제 그 구단
 * 엠블럼이 맞다(7개 전부 육안 확인 — HWASEONG·GIMPO·YONGIN·PAJU·CHEONAN·GIMHAE·충북청주).
 * 팀 번호는 네이버가 준 그대로 쓰므로 다른 팀 로고가 섞일 여지가 없다.
 *
 * 서울E(31)·충남아산(34)·안산(32) 처럼 `kleague2` 경로로 멀쩡히 200 인 팀도 있다 —
 * 그래서 경로를 통째로 바꾸지 않고 **404 가 난 것만** 대체 경로를 시도한다.
 */
const FALLBACK_REWRITES: Array<[RegExp, string]> = [
  [/\/team\/kleague2\/default\//, "/team/kleague/default/"],
];

/** 죽은 URL 에 대해 시도해 볼 대체 URL 들. 규칙에 안 걸리면 빈 배열. */
function fallbackUrls(url: string): string[] {
  return FALLBACK_REWRITES.filter(([re]) => re.test(url)).map(([re, to]) => url.replace(re, to));
}

/** URL 이 **200 이면 true**. 대체 경로 채택 판정용 — 여기서는 "확실히 있다"만 받아들인다. */
async function isLive(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: { "User-Agent": "Mozilla/5.0 (haeseol emblem check)" },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return res.ok;
  } catch {
    return false;
  }
}

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
  /** 대체 경로로 되살린 URL (원본 → 대체) */
  replaced: Record<string, string>;
}

/**
 * `data` 를 **제자리에서** 고친다. 죽은 URL 을 쓰는 팀의 `teamLogo` 를 `null` 로 바꾼다.
 */
export async function pruneDeadEmblems(
  data: StandingsData,
  check: (url: string) => Promise<boolean> = isDead,
  alive: (url: string) => Promise<boolean> = isLive,
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

  // 죽은 URL 은 버리기 전에 대체 경로를 먼저 시도한다. 지우는 것보다 채우는 게 낫다.
  const replaced: Record<string, string> = {};
  for (const u of dead) {
    for (const alt of fallbackUrls(u)) {
      if (await alive(alt)) {
        replaced[u] = alt;
        break;
      }
    }
  }

  let cleared = 0;
  for (const t of teams) {
    if (!t.teamLogo || !dead.has(t.teamLogo)) continue;
    const alt = replaced[t.teamLogo];
    if (alt) {
      t.teamLogo = alt;
    } else {
      t.teamLogo = null;
      cleared += 1;
    }
  }

  return { checked: urls.length, dead: [...dead], cleared, replaced };
}

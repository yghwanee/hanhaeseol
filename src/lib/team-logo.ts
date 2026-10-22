import standings from "@/data/standings.json";
import type { StandingsData } from "@/types/standings";
import { getTeamLogo } from "@/data/team-logos";
import { NAVER_TO_SCHEDULE_TEAM_NAME } from "@/lib/team-records/team-name-aliases";
import { flagUrl } from "@/lib/country-flags";

/**
 * 편성(schedule) 표기 → 팀 로고 URL.
 *
 * 원래 `match/[slug]/page.tsx` 안에만 있던 `findTeamLogo` 를 끌어올린 것이다. 매치 페이지는
 * 로고를 붙이는데 **홈 카드는 안 붙는** 상태였다 — `schedule.json` 189경기는 `homeEmblem`
 * 이 전부 비어 있고 `worldcup.json` 104경기만 채워져 있어서, 카드 앰블럼이 월드컵 경기에만
 * 보였다(2026-09-03 실측). 같은 규칙을 한 곳에 두고 양쪽이 쓴다.
 *
 * 순서 (앞이 이기는 이유까지):
 *  1. `team-logos.ts` — 편성 표기 기준 수기 표. 네이버 pstatic 은 핫링크가 막히는 경우가
 *     있어 ESPN/로컬 같은 안정적 소스를 순위표보다 앞에 둔다.
 *  2. 순위표(`standings.json`) 직접 일치.
 *  3. 별칭 역매핑 — 편성 표기에서 순위표 표기를 찾아 다시 2번.
 *  4. 국기 — 국가대표팀은 클럽 앰블럼이 없다.
 */

const sd = standings as unknown as StandingsData;

/**
 * 순위표 표기 → 로고, 종목별.
 *
 * 🔴 종목을 섞은 한 맵이면 안 된다(2026-10-22). 농구 순위를 넣자 NBA 「애틀랜타」·「미네소타」·
 * 「디트로이트」가 MLB 순위표의 같은 이름과 겹쳤다. 종목을 모르는 호출은 축구 → 야구 → 농구
 * 순으로 **먼저 들어간 쪽**을 쓴다(종전 동작 유지, 농구는 새로 들어와서 맨 뒤).
 */
const LOGOS_BY_SPORT: ReadonlyMap<string, ReadonlyMap<string, string>> = (() => {
  const out = new Map<string, Map<string, string>>();
  const put = (sport: string, leagues: { teams: { teamName: string; teamLogo?: string | null }[] }[]) => {
    const m = out.get(sport) ?? new Map<string, string>();
    for (const l of leagues) for (const t of l.teams) if (t.teamLogo && !m.has(t.teamName)) m.set(t.teamName, t.teamLogo);
    out.set(sport, m);
  };
  put("축구", sd.soccer);
  put("야구", sd.baseball);
  put("농구", sd.basketball ?? []);
  put("배구", sd.volleyball ?? []);
  return out;
})();
const STANDINGS_LOGOS: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const sport of ["축구", "야구", "농구"])
    for (const [k, v] of LOGOS_BY_SPORT.get(sport) ?? []) if (!m.has(k)) m.set(k, v);
  return m;
})();

/**
 * 배구 엠블럼(네이버 `team/kovo|wkovo/default/<teamId>.png`, 2026-10-22 200 실측). V리그 순위가
 * 개막(10/31) 전이라 순위표에서 못 얻어 직접 둔다. 🔴 「정관장」은 KBL 「안양 정관장」 옛 tvN
 * 표기와 겹쳐서 종목이 배구일 때만 쓴다.
 */
const KOVO = (id: string) => `https://sports-phinf.pstatic.net/team/kovo/default/${id}.png?type=f92_88`;
const WKOVO = (id: string) => `https://sports-phinf.pstatic.net/team/wkovo/default/${id}.png?type=f92_88`;
const VOLLEYBALL_LOGOS: Record<string, string> = {
  대한항공: KOVO("1001"),
  삼성화재: KOVO("1002"),
  KB손해보험: KOVO("1004"),
  현대캐피탈: KOVO("1005"),
  한국전력: KOVO("1006"),
  OK저축은행: KOVO("1008"),
  우리카드: KOVO("1009"),
  현대건설: WKOVO("2001"),
  한국도로공사: WKOVO("2002"),
  정관장: WKOVO("2003"),
  흥국생명: WKOVO("2004"),
  GS칼텍스: WKOVO("2005"),
  IBK기업은행: WKOVO("2006"),
  페퍼저축은행: WKOVO("2007"),
};

/**
 * 편성 표기 → 순위표 표기 **후보들**.
 *
 * 🔴 값이 배열인 이유: 한 편성 표기가 여러 네이버 표기에 걸린다. MLS "솔트레이크" 는
 * `"솔트 레이크"`(네이버 짧은 표기)와 `"리얼 솔트 레이크"`(순위표 표기) 양쪽의 값에
 * 들어 있는데, 단일 Map 이면 나중에 쓴 쪽이 앞을 덮어써 **로고가 있는 후보를 잃는다**
 * (2026-09-03: 이것 하나 때문에 솔트레이크만 끝까지 안 붙었다). 후보를 다 들고 있다가
 * 순위표에 실제로 있는 첫 번째를 쓴다.
 */
const SCHEDULE_TO_STANDINGS: ReadonlyMap<string, string[]> = (() => {
  const m = new Map<string, string[]>();
  for (const leagueAliases of Object.values(NAVER_TO_SCHEDULE_TEAM_NAME)) {
    for (const [naverName, scheduleNames] of Object.entries(leagueAliases)) {
      for (const sn of Array.isArray(scheduleNames) ? scheduleNames : [scheduleNames]) {
        const list = m.get(sn);
        if (list) {
          if (!list.includes(naverName)) list.push(naverName);
        } else {
          m.set(sn, [naverName]);
        }
      }
    }
  }
  return m;
})();

/** 편성 표기로 로고를 찾는다. 못 찾으면 null (호출부가 플레이스홀더를 그린다). */
function logoSportMismatch(url: string, sport?: string): boolean {
  if (!sport) return false;
  if (/\/(nba|kbl|wkbl)\//.test(url)) return sport !== "농구";
  if (/\/mlb\//.test(url)) return sport !== "야구";
  return false;
}

export function resolveTeamLogo(teamName: string, sport?: string, league?: string): string | null {
  if (sport === "배구") {
    const vb = VOLLEYBALL_LOGOS[teamName.replace(/^\d+\s+/, "")];
    if (vb) return vb;
  }

  const mapped = getTeamLogo(teamName);
  // 🔴 수기 표는 이름만 키라 종목이 다른 같은 이름이 걸린다 — 「애틀랜타」·「미네소타」가 NBA
  // 로고라 SPOTV TV MLB 짧은 표기에 NBA 로고가 붙었다(2026-10-22). 종목을 알면 URL 의 종목과 맞춰 본다.
  if (mapped && !logoSportMismatch(mapped, sport) && !(league === "WNBA" && mapped.includes("/nba/"))) return mapped;

  // WNBA 는 순위표가 없고 팀 이름(「골든스테이트」·「애틀랜타」)이 NBA 와 같다 — 순위표로 찾으면
  // NBA 팀 로고가 붙는다. 수기 표에 없으면 비워 둔다(이니셜 배지).
  if (league === "WNBA") return null;

  const logos = (sport && LOGOS_BY_SPORT.get(sport)) || STANDINGS_LOGOS;
  const direct = logos.get(teamName);
  if (direct) return direct;

  for (const candidate of SCHEDULE_TO_STANDINGS.get(teamName) ?? []) {
    const viaAlias = logos.get(candidate);
    if (viaAlias) return viaAlias;
  }

  return flagUrl(teamName);
}

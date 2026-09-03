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

/** 순위표 표기 → 로고. 종목 구분 없이 한 맵에 넣는다(팀명 충돌은 실측상 없다). */
const STANDINGS_LOGOS: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const l of [...sd.soccer, ...sd.baseball, ...sd.basketball])
    for (const t of l.teams) if (t.teamLogo) m.set(t.teamName, t.teamLogo);
  return m;
})();

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
export function resolveTeamLogo(teamName: string): string | null {
  const mapped = getTeamLogo(teamName);
  if (mapped) return mapped;

  const direct = STANDINGS_LOGOS.get(teamName);
  if (direct) return direct;

  for (const candidate of SCHEDULE_TO_STANDINGS.get(teamName) ?? []) {
    const viaAlias = STANDINGS_LOGOS.get(candidate);
    if (viaAlias) return viaAlias;
  }

  return flagUrl(teamName);
}

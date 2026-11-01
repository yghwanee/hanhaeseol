import { categoriesForLeague } from "@/lib/results/lookup";

const BEFORE_KICKOFF_MS = 15 * 60_000;
const AFTER_KICKOFF_MS = 12 * 3_600_000;
const HOT_AFTER_KICKOFF_MS = 4 * 3_600_000;

/**
 * 지금 스코어가 움직일 수 있는 리그만 고른다. 킥오프 15분 전 ~ 12시간 뒤.
 * 12시간을 넉넉히 두는 건 끝난 경기 스코어를 다음 배포까지 이어 주기 위해서다.
 * 비어 있으면 네이버에 요청을 보내지 않는다.
 */
export function activeCategories(
  schedules: { date: string; time: string; league: string }[],
  now: number,
): string[] {
  const out = new Set<string>();
  for (const s of schedules) {
    const kickoff = Date.parse(`${s.date}T${s.time}:00+09:00`);
    if (Number.isNaN(kickoff)) continue;
    if (now < kickoff - BEFORE_KICKOFF_MS || now > kickoff + AFTER_KICKOFF_MS) continue;
    for (const c of categoriesForLeague(s.league)) out.add(c);
  }
  return [...out].sort();
}

/** 스코어가 지금 움직일 수 있는 경기가 있는가. 킥오프 15분 전 ~ 4시간 뒤. 없으면 폴링을 쉰다. */
export function hasHotGame(schedules: { date: string; time: string }[], now: number): boolean {
  return schedules.some((s) => {
    const kickoff = Date.parse(`${s.date}T${s.time}:00+09:00`);
    return now >= kickoff - BEFORE_KICKOFF_MS && now <= kickoff + HOT_AFTER_KICKOFF_MS;
  });
}

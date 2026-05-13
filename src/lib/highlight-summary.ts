import type { Schedule } from "@/types/schedule";
import { isGameFinished } from "@/lib/schedule-utils";
import { pickHeroMatch } from "@/lib/hero-pick";

type WeekHeroOptions = {
  league?: string[];
  platform?: string[];
  days?: number;
  /** 한국어 해설 매치만 후보로 둘지. false면 전체 매치에서 hero 선정. */
  koreanOnly?: boolean;
};

/**
 * 인스타/유튜브 컨텐츠 자동화의 "메인 경기"(pickHeroMatch) 로직을
 * 일자별로 1회씩 적용해서 days일치를 추려낸다.
 *
 * 일자 분산을 보장하기 위해 같은 날에서 hero 1개만 뽑고 다음 날로 넘어간다.
 * 기본은 한국어 해설 매치만 후보 (사이트 핵심 가치 + 인스타 운영과 동일).
 */
export function pickWeekHeroMatches(
  schedules: Schedule[],
  opts: WeekHeroOptions = {},
): Schedule[] {
  const { league, platform, days = 7, koreanOnly = true } = opts;

  const todayStr = new Date(
    new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }),
  )
    .toISOString()
    .slice(0, 10);

  const out: Schedule[] = [];
  for (let i = 0; i < days; i++) {
    const target = new Date(todayStr);
    target.setDate(target.getDate() + i);
    const dateStr = target.toISOString().slice(0, 10);

    const candidates = schedules.filter((s) => {
      if (s.date !== dateStr) return false;
      if (isGameFinished(s.date, s.time, s.sport)) return false;
      if (league && !league.includes(s.league)) return false;
      if (platform && !platform.includes(s.platform)) return false;
      if (koreanOnly && s.koreanCommentary !== true) return false;
      return true;
    });

    const hero = pickHeroMatch(candidates);
    if (hero) out.push(hero);
  }

  return out;
}

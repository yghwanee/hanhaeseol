import scheduleData from "@/data/schedule.json";
import worldcupData from "@/data/worldcup.json";
import type { Schedule, ScheduleData } from "@/types/schedule";
import { findMatchBySlug, matchToSlug } from "@/lib/match-slug";

/**
 * 매치 맞춤 OG 카드 — 어느 경기에 굽고, 페이지가 어느 주소를 가리키는지 (2026-11-14, 이슈 #96).
 *
 * 🔴 왜 파일 컨벤션(`match/[slug]/opengraph-image.tsx`)을 버렸나
 *  ①Hobby Active CPU 초과로 계정이 잠겼고(softBlock fluidCpuDuration), 12h CPU 1위가 런타임
 *    OG 렌더였다(2026-11-01 실측 63회 49초). 그래서 빌드 때 굽는다.
 *  ②그런데 파일 컨벤션이 주입하는 og:image 주소는 한글 슬러그를 **이중 인코딩**한다
 *    (`%25EB%258C…`, 로컬 프로덕션 빌드 실측). 구운 PNG 경로와 안 맞아 런타임으로 빠진다.
 *    종전엔 런타임 렌더가 그걸 흡수해 카드가 나왔을 뿐이다.
 *  그래서 이미지는 일반 라우트 `/og/match/[slug]` 에서 굽고, 주소는 페이지가 직접 만든다.
 *
 * 맞춤 카드는 공유가 몰리는 경기 전후 하루(KST)만. 배포가 하루 4번이라 그 창은 배포가 밀어 준다.
 */
const data = scheduleData as unknown as ScheduleData;
const worldcup = worldcupData as unknown as ScheduleData;

export const OG_BASE = "https://haeseol.com";
export const OG_DEFAULT = `${OG_BASE}/og-default.png`;

/** 현재 편성 → 월드컵 순(종전 opengraph-image 와 같은 해석 순서). */
export function findCurrentMatch(slug: string): Schedule | undefined {
  return findMatchBySlug(data.schedules, slug) ?? findMatchBySlug(worldcup.schedules, slug);
}

export function isNearTodayKst(date: string, now: number = Date.now()): boolean {
  const kst = (offsetDays: number) =>
    new Date(now + offsetDays * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  return date >= kst(-1) && date <= kst(1);
}

let cached: Set<string> | null = null;

/** 맞춤 카드를 굽는 슬러그(NFC 한글 그대로). 한 빌드 워커 안에서는 한 번만 계산한다. */
export function matchOgSlugs(): Set<string> {
  if (cached) return cached;
  const out = new Set<string>();
  for (const s of [...data.schedules, ...worldcup.schedules]) {
    if (!isNearTodayKst(s.date)) continue;
    const slug = matchToSlug(s);
    if (out.has(slug)) continue;
    // 슬러그 충돌 시 렌더가 고르는 행이 같은 날짜 창 안이어야 한다.
    const resolved = findCurrentMatch(slug);
    if (!resolved || !isNearTodayKst(resolved.date)) continue;
    out.add(slug);
  }
  cached = out;
  return out;
}

/**
 * 매치 페이지가 og:image·twitter:image 로 쓸 주소. 구운 카드가 있으면 그 경로를
 * **한 번만** 인코딩해서, 없으면 기본 이미지를 준다 — 기본 쪽은 함수를 아예 안 깨운다.
 */
export function matchOgImageUrl(match: Schedule): string {
  const slug = matchToSlug(match);
  return matchOgSlugs().has(slug) ? `${OG_BASE}/og/match/${encodeURIComponent(slug)}` : OG_DEFAULT;
}

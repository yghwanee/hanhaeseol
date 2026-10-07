// src/lib/match-retention.ts
//
// 매치 페이지 보존 기간. 경기일이 이 기간보다 오래되면 `/match/*` 는 410(Gone)이다.
//
// 🔴 왜 (2026-10-07 실측):
//   · Vercel 30일 사용량이 Hobby 한도를 넘었다 — FOT 10.44/10GB · ISR Writes 236K/200K ·
//     Active CPU 5h04m/4h. 이 중 97~100% 가 한해설이고, Observability 12시간 창에서
//     `/match/[slug]` 가 **ISR 쓰기 1.7K(사실상 전부) · Active CPU 2분(약 75%)**,
//     고유 경로 798개였다. 캐시 적중 6.5% — 배포(하루 4회)마다 ISR 캐시가 비고
//     네이버봇(12시간 2.7K 요청)이 아카이브를 다시 긁을 때마다 새로 렌더된다.
//   · 그런데 클릭은 최근 경기에만 붙는다. 서치어드바이저 30일(URL 270개 전수)에서
//     매치 145장 클릭 638 — 그중 9/17~9/29 경기가 ~605, **5~8월 경기 전부 합쳐 31**.
//   · 아카이브로 들어가는 통로는 매치 페이지의 「다음 경기」·「다른 중계」 링크다(그 경기
//     날짜 기준 이웃을 건다). 봇이 옛 경기 하나에 들어오면 사슬로 아카이브 전체를 훑는다.
//
// 410 은 미들웨어(엣지)가 바로 낸다 — 함수 실행도 ISR 쓰기도 없다. 페이지에서
// `notFound()` 로 막으면 그 404 렌더 자체가 함수 호출이라 비용이 남는다.
// 사이트 안에서 매치로 거는 링크(홈 카드·팀·리그·순위·주간 하이라이트·푸시)는 전부
// 오늘 근처 경기라 이 기간 안에 있다.
//
// 🔴 이 파일은 미들웨어(엣지 런타임)에서도 import 된다 — node 모듈·데이터 JSON 을 넣지 말 것.

/** 경기일 기준 보존 일수. 30일 = 클릭이 붙은 경기(경기 후 1~3주)를 넉넉히 덮는 값. */
export const MATCH_RETENTION_DAYS = 30;

/** KST 오늘 "YYYY-MM-DD". 엣지에서도 돈다(Intl 만 쓴다). */
function kstToday(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** 이 날짜(포함)보다 이른 경기는 은퇴. "YYYY-MM-DD". */
export function matchCutoffDate(now: Date = new Date()): string {
  const [y, m, d] = kstToday(now).split("-").map(Number);
  const cutoff = new Date(Date.UTC(y, m - 1, d - MATCH_RETENTION_DAYS));
  return cutoff.toISOString().slice(0, 10);
}

/** 경기일이 보존 기간 밖이면 true. 날짜를 못 읽으면 false(막지 않는다). */
export function isRetiredMatchDate(date: string, now: Date = new Date()): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  return date < matchCutoffDate(now);
}

/**
 * 매치 슬러그(`2026-09-24-coupang-play-…`, 퍼센트 인코딩 가능)가 은퇴 경기인지.
 * 슬러그는 `matchToSlug` 가 항상 경기일로 시작한다.
 */
export function isRetiredMatchSlug(slug: string, now: Date = new Date()): boolean {
  const m = /^(\d{4}-\d{2}-\d{2})-/.exec(slug);
  return m ? isRetiredMatchDate(m[1], now) : false;
}

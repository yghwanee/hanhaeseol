export const GAME_DURATION_HOURS: Record<string, number> = {
  "축구": 2.5,
  "야구": 4.5,
  "농구": 3,
  "배구": 3,
};

export const DAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

export function formatDateHeader(isoDate: string): string {
  const [y, m, d] = isoDate.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  return `${m}월 ${d}일 (${DAY_NAMES[dt.getUTCDay()]})`;
}

/**
 * 요일 없는 짧은 날짜(`8월 10일`). 검색 쿼리에 요일이 안 들어가는데
 * `<title>` 에서는 4글자를 먹어서, 제목 전용으로 뺀다(seo-meta.buildMatchTitle 참조).
 */
export function formatShortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-").map(Number);
  return `${m}월 ${d}일`;
}

export function getUpcomingDates(): { label: string; value: string }[] {
  const dates: { label: string; value: string }[] = [];
  // KST 기준 오늘을 UTC 자정으로 취급해 일수만 더한다(달/요일 계산은 getUTC*).
  // 로컬타임으로 계산하면 서버(UTC)·클라(KST)가 달라 hydration mismatch 가 난다.
  const [y, m, d] = getTodayString().split("-").map(Number);
  const base = Date.UTC(y, m - 1, d);

  for (let i = 0; i < 7; i++) {
    const dt = new Date(base + i * 86400000);
    const yyyy = dt.getUTCFullYear();
    const mm = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(dt.getUTCDate()).padStart(2, "0");
    const value = `${yyyy}-${mm}-${dd}`;
    const label = i === 0 ? "오늘" : `${Number(mm)}/${Number(dd)}(${DAY_NAMES[dt.getUTCDay()]})`;
    dates.push({ label, value });
  }
  return dates;
}

/** KST(Asia/Seoul) 기준 오늘 "YYYY-MM-DD". 서버(UTC)·클라(로컬) 어디서 불러도 같은 값 → hydration 안전. */
export function getTodayString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function isGameFinished(date: string, time: string, sport: string): boolean {
  const [hh, mm] = time.split(":").map(Number);
  const gameStart = new Date(`${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`);
  const duration = (GAME_DURATION_HOURS[sport] ?? 3) * 60 * 60 * 1000;
  return Date.now() > gameStart.getTime() + duration;
}

/**
 * 경기가 "진행 중일 가능성이 있는" 시간대인지(킥오프~예상종료+여유 30분).
 * 라이브 스코어 폴링을 켤지 끌지 판단하는 클라 가드. 실제 진행 여부는 /api/live가 확정.
 * 예상시간은 보수적 추정이라 연장·추가시간을 위해 30분 여유를 둔다.
 */
export function isGameLive(date: string, time: string, sport: string): boolean {
  const [hh, mm] = time.split(":").map(Number);
  const start = new Date(
    `${date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+09:00`,
  ).getTime();
  const now = Date.now();
  const duration = (GAME_DURATION_HOURS[sport] ?? 3) * 60 * 60 * 1000;
  const grace = 30 * 60 * 1000;
  return now >= start && now <= start + duration + grace;
}

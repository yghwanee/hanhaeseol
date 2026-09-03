import type { Schedule, Sport } from "@/types/schedule";

/**
 * ⭐찜한 팀 — 브라우저 로컬 저장소.
 *
 * 🔴 **경기가 아니라 팀을 찜한다.** 경기는 수명이 하루라 찜해도 다음 날 사라지고,
 * 재방문 이유가 안 생기며, 푸시를 붙여도 사용자가 매번 다시 찜해야 한다. 팀은 시즌 내내
 * 살아 있어서 한 번 찜하면 매일 새 경기가 저절로 채워진다. 매치 페이지를 색인에서 뺀 것과
 * (2026-08-24) 같은 판단이다 — 수명이 하루짜리인 것에 무언가를 매달지 않는다.
 *
 * 이 모듈은 순수 함수만 둔다. React 쪽은 `use-follows.ts` 가 쓴다.
 * 푸시(B→C단계)가 붙으면 서버로 올릴 대상도 여기서 나온 키 목록이다.
 */

export const FOLLOWS_STORAGE_KEY = "hhs.teams.v1";

/** 한 브라우저에 담아 둘 최대 팀 수. */
export const MAX_FOLLOWS = 60;

/**
 * 🔴 키는 **편성 데이터(`schedule.json`)의 팀명 그대로** 쓴다. 순위표 표기로 옮기지 않는다.
 *
 * 두 표기가 한 글자만 달라도 조용히 안 붙는 사고를 이미 겪었다(`resultKey`, alias 표).
 * 홈 화면의 매칭은 이 키와 카드의 팀명이 **같은 출처**라 정확히 일치한다. 종목을 앞에 두는
 * 건 도시명을 공유하는 다른 종목 팀을 가르기 위한 것이다(`토론토` MLS vs MLB).
 */
export function teamKey(sport: Sport | string, teamName: string): string {
  return `${String(sport).trim()}|${norm(teamName)}`;
}

/** 한 경기에서 찜 대상이 되는 두 키(홈·원정). 원정이 없는 단독 편성은 하나만. */
export function teamKeysOf(s: Schedule): string[] {
  const out = [teamKey(s.sport, s.homeTeam)];
  if (s.awayTeam) out.push(teamKey(s.sport, s.awayTeam));
  return out;
}

/** 이 경기가 찜한 팀의 경기인가. */
export function isFollowedGame(s: Schedule, followed: Set<string>): boolean {
  return teamKeysOf(s).some((k) => followed.has(k));
}

/**
 * 찜한 팀이 홈이면 원정을, 원정이면 홈을 돌려준다.
 *
 * 🔴 **생 문자열로 비교하면 안 된다.** 저장된 팀명은 trim·NFC 를 거친 값이고
 * `s.homeTeam` 은 크롤 원본이다. 팀명 뒤 공백이 실제로 흘러 들어온 적이 있어
 * (2026-08-27) 생 비교를 쓰면 홈 팀을 찜했는데 상대로 **홈 팀 이름**이 뜬다.
 */
export function opponentOf(s: Schedule, teamName: string): string {
  const isHome = teamKey(s.sport, s.homeTeam) === teamKey(s.sport, teamName);
  return isHome ? s.awayTeam : s.homeTeam;
}

/** 키에서 팀명만 꺼낸다. 형식이 아니면 null. */
export function keyTeamName(key: string): string | null {
  const i = key.indexOf("|");
  if (i <= 0) return null;
  const name = key.slice(i + 1);
  return name ? name : null;
}

function norm(v: string | undefined): string {
  // 팀명 뒤 공백이 실제로 흘러 들어온 적이 있고(2026-08-27), 한글 NFD 분리는 Vercel
  // 빌드에서 났던 사고다. 저장 전에 한 번 맞춰 둬야 키가 갈리지 않는다.
  return (v ?? "").trim().normalize("NFC");
}

/**
 * 중복 제거 + 정렬 + 상한.
 *
 * 🔴 상한을 넘으면 **가장 오래된 것부터** 버린다. 반대로 하면(먼저 고른 팀 우선)
 * 60팀을 채운 사용자가 별을 눌러도 방금 누른 키가 잘려서 **아무 일도 안 일어난다.**
 * 무반응 클릭은 어떤 정책보다 나쁘다.
 */
export function normalizeFollows(keys: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const k of keys) {
    if (typeof k !== "string" || !k) continue;
    if (!keyTeamName(k)) continue;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(k);
  }
  return out.slice(-MAX_FOLLOWS).sort();
}

/** 있으면 빼고 없으면 넣는다. 원본을 건드리지 않는다. */
export function toggleFollow(keys: string[], key: string): string[] {
  return keys.includes(key)
    ? keys.filter((k) => k !== key)
    : normalizeFollows([...keys, key]);
}

/**
 * 로컬 저장소에서 읽는다.
 *
 * 🔴 접근 자체가 던지는 환경이 있다(사생활 보호 모드, 사이트 데이터 차단). 값이 없는 것과
 * 못 읽는 것을 구분하지 않고 **빈 목록**으로 떨어뜨린다 — 찜은 편의 기능이라 못 읽는다고
 * 화면이 깨지면 안 된다.
 */
export function readFollows(): string[] {
  try {
    const raw = globalThis.localStorage?.getItem(FOLLOWS_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return normalizeFollows(parsed as string[]);
  } catch {
    return [];
  }
}

/** 로컬 저장소에 쓴다. 실패하면 조용히 넘어간다(위 readFollows 와 같은 이유). */
export function writeFollows(keys: string[]): void {
  try {
    globalThis.localStorage?.setItem(
      FOLLOWS_STORAGE_KEY,
      JSON.stringify(normalizeFollows(keys)),
    );
  } catch {
    /* 저장 불가 환경 — 이번 세션에만 반영된다 */
  }
}

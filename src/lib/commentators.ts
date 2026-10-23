/**
 * 방송사 공식 해설진 명단 — 플랫폼·리그 페이지의 「해설진」 섹션.
 *
 * 2026-10-23 서치어드바이저 7일 실측: "해설" 쿼리는 클릭률 ~10% 로 우리가 이기는 자리인데,
 * 그 상당수가 **누가 해설하나**를 찾는다(`mbc 야구 해설` 315 · `kbs 야구 해설` 155 ·
 * `kbsn sports 야구 해설위원 일정` CTR 44% · `202610월16일kbs중계해설자`). 페이지엔 이름이 0 이었다.
 *
 * 🔴 명단을 손으로 적지 말 것 — 해설위원은 시즌마다 바뀐다(선수 소속 하드코딩 오보와 같은 부류).
 * `npm run crawl:commentators` 가 공식 페이지를 읽어 `src/data/commentators.json` 을 쓴다.
 * 🔴 공식 명단 페이지가 있는 방송사만 넣는다. 2026-10-23 기준 KBS N 만 있다 — MBC SPORTS+·
 * SBS Sports·tvN SPORTS·SPOTV 는 공식 사이트에 명단이 없다(sbssports.co.kr 은 공식 사이트도 아니다).
 * 🔴 경기별 배정은 방송사가 편성 데이터에 안 싣는다. 명단까지만 말한다 — "이 경기 해설은 ○○" 라고 지어내지 말 것.
 */
import data from "@/data/commentators.json";
import { withJosa } from "@/lib/josa";

export interface CommentatorGroup {
  /** 공식 페이지 표기 그대로: "야구 해설위원" · "아나운서" */
  label: string;
  /** 종목(야구·배구·농구·축구). 아나운서처럼 종목이 없으면 null */
  sport: string | null;
  names: string[];
}

export interface CommentatorSource {
  /** schedule.json 의 platform 표기와 같아야 한다 */
  platform: string;
  sourceUrl: string;
  groups: CommentatorGroup[];
}

export interface CommentatorsData {
  checkedAt: string;
  sources: CommentatorSource[];
}

/** 이보다 낡으면 화면에서 뺀다. 크롤은 매일 돈다 — 2주 연속 실패면 틀린 명단일 수 있다. */
export const COMMENTATOR_STALE_DAYS = 14;

const SPORTS = ["야구", "배구", "농구", "축구"];

function sportOf(label: string): string | null {
  return SPORTS.find((s) => label.startsWith(s)) ?? null;
}

/**
 * KBS N `아나운서&해설위원 소개` 페이지 파서.
 * `<div class="title02">배구 해설위원</div>` 머리 뒤에 `<em>이름</em>` 이 나열된다.
 */
export function parseKbsnRoster(html: string): CommentatorGroup[] {
  const groups: CommentatorGroup[] = [];
  // 한 `section announcer` 안에 머리가 여럿일 수 있다(2026-10-23 실물: 배구·야구·농구가 한 섹션).
  // 그래서 섹션이 아니라 `title02` 머리 단위로 자른다.
  const chunks = html.split(/<div class="title02">/).slice(1);
  for (const chunk of chunks) {
    const label = chunk.match(/^\s*([^<]+?)\s*<\/div>/)?.[1]?.trim();
    if (!label) continue;
    const names = [...chunk.matchAll(/<em>\s*([^<]{2,10}?)\s*<\/em>/g)].map((m) => m[1].trim());
    const unique = [...new Set(names)].filter((n) => /^[가-힣]{2,5}$/.test(n));
    if (unique.length > 0) groups.push({ label, sport: sportOf(label), names: unique });
  }
  return groups;
}

function ageDays(checkedAt: string, today: string): number {
  return (Date.parse(`${today}T00:00:00Z`) - Date.parse(checkedAt.slice(0, 10) + "T00:00:00Z")) / 86400000;
}

/**
 * 페이지에 보여 줄 명단.
 * @param platforms 이 페이지의 플랫폼 표기들(플랫폼 페이지 = meta.match, 리그 페이지 = 중계사 목록)
 * @param sport     리그 페이지면 그 종목만. 플랫폼 페이지는 생략(전 종목 + 아나운서)
 */
export function commentatorsFor(
  platforms: string[],
  today: string,
  sport?: string,
  source: CommentatorsData = data as CommentatorsData,
): { checkedOn: string; sources: CommentatorSource[] } | null {
  if (!source.checkedAt || ageDays(source.checkedAt, today) > COMMENTATOR_STALE_DAYS) return null;
  const sources = source.sources
    .filter((s) => platforms.includes(s.platform))
    .map((s) => ({ ...s, groups: s.groups.filter((g) => (sport ? g.sport === sport : true)) }))
    .filter((s) => s.groups.length > 0);
  if (sources.length === 0) return null;
  return { checkedOn: source.checkedAt.slice(0, 10), sources };
}

/**
 * 답변엔진이 문단째 잘라 가는 한 문장. [주어 + 명단 + 기준일]을 자체 보유한다.
 * 예: "2026-10-23 KBS N SPORTS 공식 홈페이지 기준 야구 해설위원은 장성호·박용택입니다."
 */
export function commentatorSentence(s: CommentatorSource, checkedOn: string): string {
  const parts = s.groups.map((g) => `${withJosa(g.label, "은/는")} ${g.names.join("·")}`);
  return `${checkedOn} ${s.platform} 공식 홈페이지 기준 ${parts.join(", ")}입니다.`;
}

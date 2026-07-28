import { LEAGUE_SEO, PLATFORM_SEO } from "@/lib/slugs";

/**
 * 가이드 본문의 리그·플랫폼 이름을 해당 편성표 페이지로 자동 연결.
 *
 * 실측 2026-07-28: 발행글 26편이 자기 사이트 링크를 **글마다 딱 1개**, 그것도 맨 아래
 * "전체 일정은 여기서" 형태로만 갖고 있었다(그마저 `https://haeseol.com/...` 절대 URL).
 * 본문에서 EPL·MLB·티빙·쿠팡플레이를 실명으로 다루면서도 그 편성표로 가는 링크는 0개였다.
 * 그래서 ①크롤러가 글에서 허브 페이지로 퍼지지 못하고 ②글을 읽은 사람이 "그래서 어디서
 * 보나"로 이어질 경로가 맨 아래 한 줄뿐이었다.
 *
 * 적용 후 26편 전부가 링크를 갖고, 자동 링크는 66개다(글당 중위 3개).
 *
 * 본문 26편을 손으로 고치는 대신 **렌더 단계에서 붙인다** — 발행된 산문을 건드리지 않고,
 * 앞으로 나올 글에도 자동 적용되며, 되돌리기도 쉽다.
 *
 * 보수적으로 동작한다:
 *  - 엔티티별 **첫 등장 한 번만** 링크한다(같은 단어를 문단마다 링크하면 스팸처럼 보인다)
 *  - 글 하나에 최대 `maxLinks`개(기본 4)
 *  - **코드 펜스·인라인 코드·이미 있는 링크·헤딩은 건드리지 않는다**
 *  - 긴 이름을 먼저 시도한다(`K리그2`가 `K리그`로 잘려 매칭되는 것 방지)
 */

type Entity = { name: string; href: string };

/**
 * 뒤에 붙어도 앞말이 그 이름 그대로인 한국어 조사·어미.
 *
 * 🔴 이 목록이 이 파일의 핵심이다. 한국어는 명사 뒤에 조사가 **붙여 쓴다**(`티빙을`,
 * `쿠팡플레이에서`). 처음엔 "이름 뒤에 한글이 오면 다른 단어"로 판정했는데, 그러면
 * 실제 문장이 거의 전부 걸러져서 링크가 하나도 안 붙었다(테스트로 잡음).
 *
 * 반대로 뒤에 오는 한글을 전부 허용하면 `티빙키드` 같은 다른 단어의 일부까지 링크된다.
 * 그래서 **조사만 화이트리스트로 허용**한다. `고`·`다`·`요` 처럼 일반 단어를 시작할 수 있는
 * 글자는 넣지 않는다(오탐이 조사 누락보다 나쁘다).
 */
const PARTICLES = [
  // 긴 것부터 — 정규식 대안은 앞에서부터 매칭되므로 순서가 중요하다.
  "에서는", "에서도", "에서만", "으로는", "이라도", "이라는", "에게는",
  "에서", "으로", "부터", "까지", "처럼", "보다", "이나", "라도", "조차", "마저", "에게", "한테", "이라",
  "은", "는", "이", "가", "을", "를", "에", "의", "도", "만", "과", "와", "로", "나", "랑", "뿐",
];

/**
 * 리그·플랫폼 외 허브. 이게 없으면 월드컵 글 17편이 링크 0개로 남는다
 * (월드컵은 `/worldcup` 이라 LEAGUE_SEO 에 없다). `한국어 해설` 은 거의 모든 글에 나오고
 * 네이버에서 CTR 이 가장 높은 쿼리군이라 착지 페이지로 연결할 값어치가 크다.
 */
const EXTRA_ENTITIES: Entity[] = [
  { name: "북중미 월드컵", href: "/worldcup" },
  { name: "월드컵", href: "/worldcup" },
  { name: "한국어 해설", href: "/commentary" },
];

/** 링크 후보. 이름이 긴 것부터 시도한다. */
export function buildEntities(): Entity[] {
  const out: Entity[] = [];
  for (const l of LEAGUE_SEO) {
    for (const n of l.match) out.push({ name: n, href: `/league/${l.slug}` });
  }
  for (const p of PLATFORM_SEO) {
    for (const n of p.match) out.push({ name: n, href: `/platform/${p.slug}` });
  }
  out.push(...EXTRA_ENTITIES);
  // 같은 이름이 여러 슬러그에 걸리면 먼저 선언된 쪽만 남긴다.
  const seen = new Set<string>();
  return out
    .filter((e) => (seen.has(e.name) ? false : (seen.add(e.name), true)))
    .sort((a, b) => b.name.length - a.name.length);
}

/** 정규식 특수문자 이스케이프. 플랫폼 이름에 `+`(MBC SPORTS+)가 들어간다. */
function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * 보호 구간 표식.
 *
 * 처음엔 공백+숫자+공백(` 3 `)을 썼는데 본문의 평범한 숫자와 구분이 안 돼 복원이 엉켰고,
 * 코드펜스·헤딩 보호가 통째로 깨졌다(테스트로 잡았다). 제어문자도 써봤지만 소스 파일이
 * 바이너리로 인식돼 도구 체인에 좋지 않다. 마크다운 본문에 나올 수 없는 문자열을 쓴다.
 */
const MARK = "@@HHS-PROTECT-";
const MARK_END = "-PROTECT@@";

/**
 * 건드리면 안 되는 구간을 자리표시자로 빼둔다.
 * 코드 펜스 → 인라인 코드 → 기존 링크/이미지 → 헤딩 줄 순서로 보호한다.
 */
function protectRegions(md: string): { text: string; restore: (s: string) => string } {
  const stash: string[] = [];
  const keep = (m: string) => {
    stash.push(m);
    return `${MARK}${stash.length - 1}${MARK_END}`;
  };
  const text = md
    .replace(/```[\s\S]*?```/g, keep)
    .replace(/`[^`\n]*`/g, keep)
    .replace(/!?\[[^\]]*\]\([^)]*\)/g, keep)
    .replace(/^#{1,6} .*$/gm, keep);
  return {
    text,
    restore: (s) =>
      s.replace(new RegExp(`${MARK}(\\d+)${MARK_END}`, "g"), (_, i) => stash[Number(i)]),
  };
}

/**
 * 자기 사이트를 절대 URL로 가리키는 링크를 상대 경로로 바꾼다.
 *
 * 실측 2026-07-28: 가이드 26편 전부가 `](https://haeseol.com/...)` 형태로 자기 링크를
 * 걸고 있었다. 동작은 하지만 도메인이 본문에 박혀 있어 좋지 않고(도메인 변경 시 전부 깨짐),
 * 내부 링크인데 외부 링크처럼 보인다. 원문 파일은 건드리지 않고 렌더 단계에서만 바꾼다.
 */
export function relativizeSelfLinks(markdown: string): string {
  return markdown.replace(
    /\](\(https?:\/\/(?:www\.)?haeseol\.com(\/[^)\s]*)?\))/g,
    (_, _full, path) => `](${path || "/"})`,
  );
}

export function autolinkGuideBody(markdown: string, maxLinks = 4): string {
  // 🔴 정규화를 먼저 하고, 아래 중복 검사도 **정규화된 문자열**을 봐야 한다.
  // 원문을 보면 `](https://haeseol.com/worldcup)` 가 `(/worldcup)` 로 안 잡혀서
  // 같은 목적지에 링크가 두 번 붙는다(테스트로 잡았다).
  const normalized = relativizeSelfLinks(markdown);
  const { text, restore } = protectRegions(normalized);
  const particleAlt = PARTICLES.map(esc).join("|");
  let out = text;
  let added = 0;

  for (const { name, href } of buildEntities()) {
    if (added >= maxLinks) break;
    // 이미 이 경로로 가는 링크가 있으면 건너뛴다(중복 링크 방지).
    if (normalized.includes(`(${href})`)) continue;

    // 앞: 문장 시작이거나 한글·영숫자가 아닌 문자(다른 단어의 꼬리가 아님을 보장).
    // 뒤: 끝이거나 한글·영숫자가 아닌 문자, 또는 위 조사 목록으로 시작.
    const re = new RegExp(
      `(^|[^0-9A-Za-z가-힣])(${esc(name)})(?=$|[^0-9A-Za-z가-힣]|(?:${particleAlt})(?![0-9A-Za-z가-힣]))`,
    );
    if (!re.test(out)) continue;

    out = out.replace(re, `$1[$2](${href})`);
    added++;
  }

  return restore(out);
}

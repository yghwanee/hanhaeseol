// 네이버 pstatic 로고/국기는 핫링크 차단 때문에 same-origin 프록시(/api/emblem)를 경유한다.
//
// 배경: sports-phinf.pstatic.net 은 Referer 헤더에 외부 도메인(haeseol.com)이 있으면 403을
// 반환한다(핫링크 보호). <img referrerPolicy="no-referrer"> 로 회피하려 했지만, 첫 페인트 때
// 브라우저 preload 스캐너가 문서 기본 정책(strict-origin-when-cross-origin)으로 Referer를
// 붙여 보내 403 → 국기가 빈 상태로 뜨고, 새로고침(캐시/요소 정책 적용) 후에야 보였다.
// 서버가 Referer 없이 받아와 우리 도메인에서 서빙하면 이 문제가 근본적으로 사라진다.
const PROXY_HOSTS = new Set(["sports-phinf.pstatic.net"]);

/** pstatic 로고 URL이면 same-origin 프록시 경로로, 그 외(로컬/상대경로)는 그대로 반환. */
export function proxyLogo(url: string): string {
  try {
    if (PROXY_HOSTS.has(new URL(url).hostname)) {
      return `/api/emblem?u=${encodeURIComponent(url)}`;
    }
  } catch {
    // 상대경로(/icon.png 등)는 URL 파싱 실패 → 그대로 사용
  }
  return url;
}

/**
 * 국기냐 클럽 엠블럼이냐.
 *
 * 카드의 앰블럼 자리는 원래 **국기 전용**이었다(`w-5 h-3.5` = 20×14 + `object-cover`).
 * 국기는 가로:세로가 3:2 라 그 박스에 딱 맞고 `cover` 로 잘려도 티가 안 난다.
 *
 * 🔴 그런데 2026-09-03 에 클럽 엠블럼을 같은 자리에 넣으면서 깨졌다. KBO 로고는
 * **184×184 정사각**이라, 20×14 박스에 `cover` 로 넣으면 폭 20 에 맞춰 확대된 뒤
 * **위아래가 각각 3px(21%) 잘려 나간다.** 둥근 로고(두산·LG)는 위아래가 썰려
 * 뭉개진 덩어리로 보였다. 자를 게 아니라 `contain` + 정사각 박스로 담아야 한다.
 *
 * 판별은 호스트로 한다 — 국기는 `country-flags.ts`·`team-logos.ts` 의 `FLAG()` 가
 * 전부 flagcdn.com 을 쓴다. 프록시를 거친 경로(`/api/emblem?u=...`)는 pstatic 전용이라
 * 국기가 될 수 없다(flagcdn 은 핫링크 제한이 없어 프록시를 안 탄다).
 */
export function isFlagEmblem(url: string): boolean {
  return url.includes("flagcdn.com");
}

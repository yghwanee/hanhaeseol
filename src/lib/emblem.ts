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

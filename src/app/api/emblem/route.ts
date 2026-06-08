// 네이버 pstatic 로고/국기 same-origin 이미지 프록시.
// 서버가 Referer 없이 받아와(핫링크 403 회피) 우리 도메인에서 서빙 → 첫 페인트에 바로 표시.
// SSRF/오픈 프록시 방지: 허용 호스트 화이트리스트 + https만.

const ALLOWED_HOSTS = new Set(["sports-phinf.pstatic.net"]);

export async function GET(request: Request): Promise<Response> {
  const u = new URL(request.url).searchParams.get("u");
  if (!u) return new Response("missing u", { status: 400 });

  let target: URL;
  try {
    target = new URL(u);
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED_HOSTS.has(target.hostname)) {
    return new Response("forbidden host", { status: 403 });
  }

  let upstream: Response;
  try {
    // 서버 측 fetch는 기본적으로 Referer를 보내지 않음 → pstatic이 200으로 응답.
    upstream = await fetch(target.toString(), {
      headers: { "User-Agent": "Mozilla/5.0 (haeseol image proxy)" },
    });
  } catch {
    return new Response("upstream fetch failed", { status: 502 });
  }
  if (!upstream.ok) {
    return new Response(`upstream ${upstream.status}`, { status: 502 });
  }
  const contentType = upstream.headers.get("content-type") ?? "image/png";
  if (!contentType.startsWith("image/")) {
    return new Response("not an image", { status: 415 });
  }

  const body = await upstream.arrayBuffer();
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      // 국기/로고는 거의 불변 → 브라우저 + Vercel CDN 장기 캐시.
      "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
    },
  });
}

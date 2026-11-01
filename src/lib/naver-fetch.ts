import https from "node:https";

/**
 * api-gw.sports.naver.com 전용 fetch. 응답은 표준 Response 라 호출부는 fetch 와 똑같이 쓴다.
 *
 * 🔴 TLS 1.2 고정이 이 파일의 존재 이유다 (2026-11-01 실측). 2026-10-26 부터 이 호스트는
 * TLS 1.3 연결에서 요청을 받고도 응답을 안 줘 타임아웃이 난다. TLS 1.2 면 0.1초에 200 이다.
 * 전역 fetch 는 TLS 버전을 못 정해서 node:https 로 직접 부른다.
 *
 * 🔴 이걸로 되는 건 일반 회선뿐이다. GH 러너는 TLS 1.2 도 무응답, Vercel(서울 포함)은 ECONNRESET 이다.
 *
 * Next.js Data Cache 를 거치지 않으므로 `cache: "no-store"` 도 필요 없다.
 */
const DEFAULT_TIMEOUT_MS = 15_000;

export function naverFetch(
  url: string,
  init: { headers?: Record<string, string>; signal?: AbortSignal } = {},
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const req = https.get(
      url,
      {
        headers: init.headers,
        maxVersion: "TLSv1.2",
        signal: init.signal ?? AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("error", reject);
        res.on("end", () => {
          resolve(new Response(Buffer.concat(chunks), { status: res.statusCode ?? 502 }));
        });
      },
    );
    req.on("error", reject);
  });
}

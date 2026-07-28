/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "sports-phinf.pstatic.net" },
    ],
  },
  async headers() {
    return [
      {
        source: "/schedule.json",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, stale-while-revalidate=7200",
          },
        ],
      },
      {
        // 보안 헤더. 라이브에 HSTS 만 있었다(2026-07-28 실측).
        //
        // 순위 영향은 작다 — HTTPS 는 확인된 신호지만 가볍고, 페이지 경험은 단일
        // 랭킹 시스템이 아니다. 그래서 SEO 이득을 기대해서 넣는 게 아니라,
        // **비용이 0이고 실제 위험(MIME 스니핑·클릭재킹·리퍼러 유출)을 줄이기** 때문에 넣는다.
        //
        // CSP 는 넣지 않는다. 인스타·유튜브 임베드와 AdSense·쿠팡 스크립트가 얽혀 있어
        // 잘못 쓰면 페이지가 통째로 깨지고, 그 위험이 이득보다 크다.
        source: "/:path*",
        headers: [
          // MIME 스니핑 차단. 업로드/프록시 경로에서 실행형으로 오해되는 것을 막는다.
          { key: "X-Content-Type-Options", value: "nosniff" },
          // 클릭재킹 방지. 우리 페이지를 남의 프레임에 넣을 이유가 없다.
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          // 외부로 나갈 때 경로·쿼리를 흘리지 않는다(오리진까지만).
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          // 쓰지 않는 강력 권한은 닫는다.
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), payment=()",
          },
        ],
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "xn--989ar05c.kro.kr" }],
        destination: "https://haeseol.com/:path*",
        permanent: true,
      },
      {
        source: "/:path*",
        has: [{ type: "host", value: "중계.kro.kr" }],
        destination: "https://haeseol.com/:path*",
        permanent: true,
      },
      { source: "/ig", destination: "/?utm_source=instagram&utm_medium=bio", permanent: false },
      { source: "/ig/post", destination: "/?utm_source=instagram&utm_medium=post", permanent: false },
      { source: "/ig/reel", destination: "/?utm_source=instagram&utm_medium=reel", permanent: false },
      { source: "/ig/story", destination: "/?utm_source=instagram&utm_medium=story", permanent: false },
      { source: "/yt", destination: "/?utm_source=youtube&utm_medium=desc", permanent: false },
      { source: "/tt", destination: "/?utm_source=tiktok&utm_medium=caption", permanent: false },
    ];
  },
};

export default nextConfig;

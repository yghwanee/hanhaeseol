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
      // 🔴 Vercel 프로덕션 별칭(`hanhaeseol.vercel.app`)이 사이트 전체를 200 + robots
      // `index, follow` 로 서빙하고 있었다(2026-08-13 실측: 홈 바이트가 haeseol.com 과
      // 동일한 377,267). canonical 이 haeseol.com 을 가리켜도 canonical 은 제안이지
      // 명령이 아니라, 사이트맵 2,011 URL 이 통째로 중복 후보가 된다. 301 로 한쪽만 남긴다.
      //
      // 프리뷰 배포(`hanhaeseol-git-*.vercel.app` 등)는 Vercel 이 자동으로 noindex 를
      // 붙이므로 **정확히 이 호스트만** 매칭한다(와일드카드로 잡으면 프리뷰가 깨진다).
      {
        source: "/:path*",
        has: [{ type: "host", value: "hanhaeseol.vercel.app" }],
        destination: "https://haeseol.com/:path*",
        permanent: true,
      },
      // www 도 같은 이유. Vercel 도메인 설정이 기본 307(임시)이라 신호가 합쳐지지 않는다.
      // 대시보드 쪽 리다이렉트가 먼저 먹으면 이 규칙은 안 타지만, 비용이 0이라 남겨 둔다.
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.haeseol.com" }],
        destination: "https://haeseol.com/:path*",
        permanent: true,
      },
      // Vercel 파일시스템 라우팅이 `/index` 를 `/` 로 해석해 홈과 **바이트가 같은**
      // 응답을 200 으로 준다(2026-08-13 실측). 앱 라우터에 `/index` 라우트는 없다.
      // 색인 중복이라 301 로 접는다.
      { source: "/index", destination: "/", permanent: true },
      // 원본 로고(3496x3496 / 1.26MB)는 소셜 카드 렌더 전용이라 `assets/logo.png` 로
      // 옮겼다 — public 에 두면 배포 정적 자산에 1.26MB 가 그대로 실리고, 봇이 그 URL 을
      // 그대로 받아 간다. 웹에서 쓰는 건 `logo-1200.png`(199KB) 하나뿐이지만,
      // 예전 구조화 데이터가 이 주소를 참조했을 수 있어 404 대신 301 로 넘긴다.
      { source: "/logo.png", destination: "/logo-1200.png", permanent: true },
      { source: "/ig", destination: "/?utm_source=instagram&utm_medium=bio", permanent: false },
      { source: "/ig/post", destination: "/?utm_source=instagram&utm_medium=post", permanent: false },
      { source: "/ig/reel", destination: "/?utm_source=instagram&utm_medium=reel", permanent: false },
      { source: "/ig/story", destination: "/?utm_source=instagram&utm_medium=story", permanent: false },
      { source: "/yt", destination: "/?utm_source=youtube&utm_medium=desc", permanent: false },
      { source: "/tt", destination: "/?utm_source=tiktok&utm_medium=caption", permanent: false },
      // 2026 북중미 월드컵 허브 제거(대회 종료, 2026-07-30). IndexNow로 통지했던 색인
      // URL이라 404 대신 301로 홈에 흡수시킨다.
      { source: "/worldcup", destination: "/", permanent: true },
      { source: "/worldcup/:path*", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;

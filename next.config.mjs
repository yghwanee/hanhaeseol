/** @type {import('next').NextConfig} */
const nextConfig = {
  // 매치 동적 OG 이미지(opengraph-image)가 런타임에 읽는 Pretendard 폰트를
  // Vercel 서버리스 번들에 강제 포함. (fs.readFileSync는 자동 트레이싱이 안 됨.)
  experimental: {
    outputFileTracingIncludes: {
      "/match/[slug]/opengraph-image": ["./templates/fonts/Pretendard-*.otf"],
    },
  },
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

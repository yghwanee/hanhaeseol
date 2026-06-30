import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import Script from "next/script";
import { loadScheduleLastUpdated } from "@/lib/server-data";
import { CoupangSideBanners } from "./_components/CoupangBanners";
import { CapsStripeClickHandler } from "./_components/CapsStripeClickHandler";
import { PageTransition } from "./_components/PageTransition";
import { ServiceWorkerRegister } from "./_components/ServiceWorkerRegister";
import { FocusRefresh } from "./_components/FocusRefresh";
import { InstallPrompt } from "./_components/InstallPrompt";
import { PullToRefresh } from "./_components/PullToRefresh";
import { PushSubscribeButton } from "./_components/PushSubscribeButton";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

// iOS PWA 런치스크린(흰 화면 방지). 기기 해상도별 어두운 스플래시 이미지를
// media 쿼리로 매칭해야 흰 번쩍 없이 어두운 스플래시가 뜬다. [cssW, cssH, dpr] portrait.
const APPLE_SPLASH: [number, number, number][] = [
  [430, 932, 3], [393, 852, 3], [402, 874, 3], [440, 956, 3], [390, 844, 3],
  [375, 812, 3], [414, 896, 3], [414, 896, 2], [414, 736, 3], [375, 667, 2], [320, 568, 2],
];

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // maximumScale 를 두지 않는다 — 저시력 사용자의 핀치 줌 확대를 막으면 안 됨(WCAG 1.4.4).
  themeColor: "#0a0a0a",
};

export const metadata: Metadata = {
  metadataBase: new URL("https://haeseol.com"),
  title: "한국어 해설 중계 편성표 - 오늘 EPL·KBO·MLB·라리가 일정 | 한해설",
  description:
    "EPL·KBO·MLB·라리가·UCL 등 한국어 해설 중계 일정을 SPOTV NOW·쿠팡플레이·티빙·SPOTV 등 10개 플랫폼에서 한 페이지에. 오늘부터 7일치 편성표, 어디서 시청할지 한눈에.",
  keywords: [
    "한국어중계", "한국어 중계", "한국어 해설", "한국어해설", "스포츠 중계 편성표", "스포츠 편성표",
    "해외축구 한국어중계", "해외축구 한국어 해설", "해외축구 중계", "EPL 중계", "EPL 한국어중계", "라리가 중계",
    "프리미어리그 중계", "프리미어리그 한국어중계", "챔피언스리그 중계", "세리에A 중계", "분데스리가 중계",
    "MLB 중계", "NBA 중계", "KBO 중계", "K리그 중계",
    "KBO 중계 편성표", "K리그 중계 편성표",
    "오늘 축구 중계", "오늘 야구 중계", "오늘 농구 중계", "오늘 배구 중계",
    "오늘 한국어중계", "축구 한국어중계", "야구 한국어중계",
    "스포츠 채널 편성표", "TV 스포츠 편성표",
    "SPOTV", "SPOTV NOW 편성표", "쿠팡플레이", "쿠팡플레이 편성표",
    "티빙", "티빙 스포츠", "Apple TV+ 스포츠", "한해설",
    "tvN SPORTS 편성표", "KBS N SPORTS 편성표", "MBC SPORTS+ 편성표", "SBS Sports 편성표",
    "실시간 중계", "스포츠 중계",
  ],
  openGraph: {
    title: "한해설 - 스포츠 한국어중계 편성표",
    description:
      "축구, 야구, 농구, 배구 한국어중계 편성표. 10개 플랫폼의 한국어 해설 중계를 한눈에.",
    url: "https://haeseol.com",
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "/og-default.png",
        width: 1200,
        height: 630,
        alt: "한해설 - 스포츠 한국어해설 편성표",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "한해설 - 스포츠 한국어중계 편성표",
    description:
      "축구, 야구, 농구, 배구 한국어중계 편성표. 10개 플랫폼의 한국어 해설 중계를 한눈에.",
    images: ["/og-default.png"],
  },
  alternates: {
    canonical: "https://haeseol.com",
    types: {
      "application/rss+xml": [
        { url: "https://haeseol.com/rss.xml", title: "한해설 RSS 피드" },
      ],
    },
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "한해설",
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-48x48.png", sizes: "48x48", type: "image/png" },
      { url: "/favicon-192x192.png", sizes: "192x192", type: "image/png" },
      { url: "/favicon-512x512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const scheduleLastUpdated = loadScheduleLastUpdated();
  return (
    <html lang="ko" className="dark" style={{ backgroundColor: "#0a0a0a" }}>
      <head>
        {/* 첫 페인트 전 웹뷰 기본 캔버스색을 어둡게(흰 번쩍 방지). head에서 일찍 적용. */}
        <meta name="color-scheme" content="dark" />
        {/* 당겨서 새로고침 reload면 인트로를 첫 페인트부터 숨김(SSR 인트로가 한 프레임
            보이는 깜빡 방지). React보다 먼저 동기 실행되어야 해서 head 인라인 스크립트. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(sessionStorage.getItem('hhs-skip-intro-once'))document.documentElement.classList.add('skip-intro')}catch(e){}",
          }}
        />
        {/* Pretendard CDN 제거 — 브라우저에선 인트로 타이틀만 쓰던 걸 Geist로 바꿔
            더 이상 필요 없음. (렌더 차단 @import도, 폰트 스왑 FOUT 깜빡도 없앰.
            인스타/릴스 이미지 생성용 Pretendard는 node-canvas 로컬 폰트라 무관.) */}
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-F1MX6S0SGW" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-F1MX6S0SGW');`}
        </Script>
        {/* 인트로 엠블럼 프리로드는 인트로가 뜨는 메인 페이지(page.tsx)에서만 한다.
            (layout 에 두면 /guide·/match 등 인트로 없는 페이지에서도 이미지 21개를
            높은 우선순위로 받아 그 페이지 본문 로딩을 느리게 만든다.) */}
        {/* iOS 설치형 앱 런치스크린 — 흰 번쩍 방지(어두운 스플래시). */}
        {APPLE_SPLASH.map(([w, h, r]) => {
          const W = w * r;
          const H = h * r;
          return (
            <link
              key={`${W}x${H}`}
              rel="apple-touch-startup-image"
              media={`screen and (device-width: ${w}px) and (device-height: ${h}px) and (-webkit-device-pixel-ratio: ${r}) and (orientation: portrait)`}
              href={`/splash/apple-splash-${W}x${H}.png`}
            />
          );
        })}
        <meta name="msvalidate.01" content="BAF456457E39D2FDB1A54BF8674FA2C6" />
        <meta name="google-site-verification" content="qe2Z2hjBEFJqqq_nEcLigG8aEiQdotP4_6jouBXE5aE" />
        <meta name="naver-site-verification" content="d9be7cb662b83910f698f22aea4b0267c91e53f4" />
        <meta name="google-adsense-account" content="ca-pub-3233121387897003" />
        {/* TODO: 다음(Daum) 검색등록 후 verification 값 입력 */}
        {/* <meta name="daum-site-verification" content="" /> */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@graph": [
                {
                  "@type": "WebSite",
                  "name": "한해설",
                  "alternateName": "한국어 해설 편성표",
                  "url": "https://haeseol.com",
                  "description": "축구, 야구, 농구, 배구 한국어중계 편성표. 10개 플랫폼의 한국어 해설 중계를 한눈에 확인하세요.",
                  "inLanguage": "ko",
                  "datePublished": "2026-02-01T00:00:00+09:00",
                  "dateModified": scheduleLastUpdated,
                },
                {
                  "@type": "Organization",
                  "name": "한해설",
                  "alternateName": "HanHaesul",
                  "url": "https://haeseol.com",
                  "logo": "https://haeseol.com/icon.png",
                  // sameAs: Google/AI Overviews가 같은 entity로 인식하도록 다른 채널 연결.
                  // 한해설 운영 채널 — 매일 자동 게시 파이프라인 운영 중.
                  "sameAs": [
                    "https://www.instagram.com/hanhaeseol/",
                    "https://www.youtube.com/@hanhaeseol",
                    "https://www.tiktok.com/@hanhaeseol",
                  ],
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${geistSans.variable} antialiased`} style={{ backgroundColor: "#0a0a0a" }}>
        <CoupangSideBanners />
        <CapsStripeClickHandler />
        <ServiceWorkerRegister />
        <FocusRefresh />
        <PullToRefresh />
        <InstallPrompt />
        <PageTransition>{children}</PageTransition>
        <footer className="border-t border-zinc-800 bg-zinc-950 px-4 py-8 text-center">
          <nav className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-zinc-400">
            <Link href="/" className="hover:text-white">홈</Link>
            <Link href="/guide" className="hover:text-white">한해설 Topic</Link>
            <Link href="/worldcup" className="hover:text-white">월드컵</Link>
            <Link href="/standings" className="hover:text-white">순위</Link>
            <Link href="/about" className="hover:text-white">소개</Link>
            <Link href="/faq" className="hover:text-white">FAQ</Link>
            <PushSubscribeButton />
          </nav>
          <p className="mt-4 text-xs text-zinc-400">© 2026 한해설</p>
        </footer>
      </body>
    </html>
  );
}

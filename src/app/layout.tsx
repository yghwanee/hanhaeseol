import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import { loadScheduleLastUpdated } from "@/lib/server-data";
import { SideBanners } from "./_components/SideBanners";
import { CapsStripeClickHandler } from "./_components/CapsStripeClickHandler";
import { PageTransition } from "./_components/PageTransition";
import { ServiceWorkerRegister } from "./_components/ServiceWorkerRegister";
import { FocusRefresh } from "./_components/FocusRefresh";
import { InstallPrompt } from "./_components/InstallPrompt";
import { PullToRefresh } from "./_components/PullToRefresh";
import { SiteFooter } from "./_components/SiteFooter";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

// Pretendard — ebook 배너 인용구 전용. preload 안 함(배너 한 곳만 써서 전 페이지
// 블로킹 방지), display:swap 이라 폰트 로드 전엔 시스템 산세리프로 보이다 교체.
const pretendard = localFont({
  src: [
    { path: "../../public/fonts/Pretendard-Regular.otf", weight: "400", style: "normal" },
    { path: "../../public/fonts/Pretendard-Bold.otf", weight: "700", style: "normal" },
  ],
  variable: "--font-pretendard",
  display: "swap",
  preload: false,
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
  // 🔴 브랜드가 선두에 와야 한다. 종전 제목은 `한해설` 이 35번째 글자(파이프 뒤)였고
  // description 에는 아예 없었다. 반면 `/about` 은 제목·설명 둘 다 첫 글자가 `한해설`
  // 이라, 브랜드 검색 `한해설` 에서 구글이 홈 대신 `/about` 을 골랐다(2026-08-13 실측).
  // 시킨 대로 동작한 것이지 이상 동작이 아니다.
  //
  // 다만 주력 쿼리군은 `한국어 해설 중계 편성표` 계열(네이버 CTR 23%)이라 브랜드를
  // 앞세우면서 그 구절을 **6번째 글자**에 둬, 앞 30자 안에 둘 다 들어가게 했다.
  // 이 순서를 뒤집을 때는 브랜드 검색과 편성표 쿼리 중 무엇을 버리는지 먼저 볼 것.
  title: "한해설 - 한국어 해설 중계 편성표 | 오늘 EPL·KBO·MLB 일정",
  description:
    "한해설은 EPL·KBO·MLB·라리가·UCL 등 한국어 해설 중계 일정을 SPOTV NOW·쿠팡플레이·티빙·SPOTV 등 10개 플랫폼에서 한 페이지에 모읍니다. 오늘부터 7일치 편성표로 어디서 볼지 한눈에.",
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
    // 구글 디스커버는 대형 이미지 미리보기를 허용한 페이지만 카드로 띄운다.
    // 기본값(max-image-preview:standard)이면 후보에서 빠진다.
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
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
        {/* CSS 유실 자가복구.
            브라우저가 옛 HTML 을 들고 있으면 그 HTML 이 가리키는
            /_next/static/css/<contenthash>.css 가 이미 지워져 404 난다(Vercel 은
            이전 배포의 정적 파일을 안 남긴다). 그러면 Tailwind 가 통째로 없는 채로
            렌더돼 인트로가 화면을 못 덮고, next/image fill 의 인라인
            position:absolute;inset:0 이 뷰포트 기준이 되어 상단 배너가 전면 확대된다.
            (아이폰 사파리에서 실제 신고 — 새로고침하면 정상으로 돌아옴.)

            이 스크립트는 스타일시트 link 뒤에 있고, 스크립트는 앞선 스타일시트 로드를
            기다리므로 여기서 이미 성패가 갈려 있다.

            🔴 **`location.reload()` 를 쓰지 않는다.** 종전 구현이 head 인라인에서
            리로드를 걸었는데, 네이버 서치어드바이저 사이트 간단체크가 홈을
            **"JavaScript를 활용한 redirect"** 로 판정해 **사이트 제목·설명·Open Graph
            를 전부 "없음"** 으로 처리하고 있었다(2026-08-13 실측). Yeti 로 직접 받아
            보면 title·description·og:title 이 멀쩡히 들어 있으므로, 못 받은 게 아니라
            **읽고 버린 것**이다. 유입의 78% 가 네이버인데 홈 메타가 색인에 통째로
            비어 있었고, 브랜드 검색 `한해설` 에서 홈 대신 하위 페이지가 뜨던 직접 원인이다.

            그래서 리로드 대신 **스타일시트를 그 자리에서 다시 주입**한다. 페이지 이동이
            아니라 리다이렉트로 오인될 여지가 없고, 화면이 안 끊겨 사용자 경험도 낫다.
            현재 배포의 해시를 stale HTML 은 모르므로 홈 HTML 을 새로 받아 거기 적힌
            css 경로를 그대로 쓴다. 실패해도 조용히 넘어간다 — 인트로 오버레이와 배너
            컨테이너에는 클래스와 같은 값이 인라인으로도 박혀 있어, 자가복구가 실패해도
            전면 확대 같은 파국은 나지 않는다.

            🔴 이 스크립트에 `location` 을 다시 넣지 말 것. 넣는 순간 네이버가 홈
            메타를 다시 버린다. */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{if(!getComputedStyle(document.documentElement).getPropertyValue('--hhs-css').trim()){fetch('/',{cache:'reload'}).then(function(r){return r.text()}).then(function(t){var m=t.match(/\\/_next\\/static\\/css\\/[^\"']+\\.css/g)||[];var s={};m.forEach(function(h){if(s[h])return;s[h]=1;var l=document.createElement('link');l.rel='stylesheet';l.href=h;document.head.appendChild(l)})}).catch(function(){})}}catch(e){}",
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
                  "@id": "https://haeseol.com/#website",
                  "name": "한해설",
                  // 🔴 `한해설` 은 구글이 `한해`+`설` 로 쪼개 읽어 설날·어원 문서와 경쟁한다
                  // (2026-08-13 SERP 실측). 브랜드 문자열 변형을 전부 적어 같은 엔티티로
                  // 묶이게 한다. 실제로 쓰이는 표기만 넣을 것 — 없는 별칭을 지어내면
                  // 엔티티가 오히려 흐려진다.
                  "alternateName": ["한국어 해설 편성표", "한해설닷컴", "haeseol", "haeseol.com", "HanHaesul"],
                  "url": "https://haeseol.com",
                  "publisher": { "@id": "https://haeseol.com/#organization" },
                  "description": "축구, 야구, 농구, 배구 한국어중계 편성표. 10개 플랫폼의 한국어 해설 중계를 한눈에 확인하세요.",
                  "inLanguage": "ko",
                  "datePublished": "2026-02-01T00:00:00+09:00",
                  "dateModified": scheduleLastUpdated,
                },
                {
                  "@type": "Organization",
                  "@id": "https://haeseol.com/#organization",
                  "name": "한해설",
                  "alternateName": ["HanHaesul", "한해설닷컴", "haeseol.com"],
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
      <body className={`${geistSans.variable} ${pretendard.variable} antialiased`} style={{ backgroundColor: "#0a0a0a" }}>
        <SideBanners />
        <CapsStripeClickHandler />
        <ServiceWorkerRegister />
        <FocusRefresh />
        <PullToRefresh />
        <InstallPrompt />
        <PageTransition>{children}</PageTransition>
        <SiteFooter />
      </body>
    </html>
  );
}

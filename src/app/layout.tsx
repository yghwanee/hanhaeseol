import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import Script from "next/script";
import scheduleData from "@/data/schedule.json";
import { CoupangSideBanners } from "./_components/CoupangBanners";
import "./globals.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  metadataBase: new URL("https://haeseol.com"),
  title: "한해설 - 스포츠 한국어중계 편성표 | 한국어 해설 중계 일정",
  description:
    "축구, 야구, 농구, 배구 한국어중계 편성표. 10개 플랫폼의 한국어 해설 중계 일정을 한눈에 확인하세요.",
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
        url: "https://haeseol.com/logo.png",
        alt: "한해설 로고",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "한해설 - 스포츠 한국어중계 편성표",
    description:
      "축구, 야구, 농구, 배구 한국어중계 편성표. 10개 플랫폼의 한국어 해설 중계를 한눈에.",
  },
  alternates: {
    canonical: "https://haeseol.com",
  },
  robots: {
    index: true,
    follow: true,
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
  return (
    <html lang="ko" className="dark">
      <head>
        <Script src="https://www.googletagmanager.com/gtag/js?id=G-F1MX6S0SGW" strategy="afterInteractive" />
        <Script id="gtag-init" strategy="afterInteractive">
          {`window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-F1MX6S0SGW');`}
        </Script>
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
                  "dateModified": scheduleData.lastUpdated,
                },
                {
                  "@type": "Organization",
                  "name": "한해설",
                  "url": "https://haeseol.com",
                  "logo": "https://haeseol.com/icon.png",
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${geistSans.variable} antialiased`}>
        <CoupangSideBanners />
        {children}
      </body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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
  title: "한해설 - 스포츠 한국어 해설 편성표",
  description:
    "축구, 야구, 농구, 배구 한국어 해설 중계 편성표. SPOTV, 쿠팡플레이, 티빙, Apple TV+ 등 10개 플랫폼의 스포츠 중계를 한눈에 확인하세요.",
  keywords: [
    "한국어 해설", "한국어 중계", "스포츠 중계 편성표", "스포츠 편성표",
    "해외축구 한국어 해설", "해외축구 중계", "EPL 중계", "라리가 중계",
    "프리미어리그 중계", "챔피언스리그 중계", "세리에A 중계", "분데스리가 중계",
    "MLB 중계", "NBA 중계", "KBO 중계", "K리그 중계",
    "KBO 중계 편성표", "K리그 중계 편성표",
    "오늘 축구 중계", "오늘 야구 중계", "오늘 농구 중계", "오늘 배구 중계",
    "스포츠 채널 편성표", "TV 스포츠 편성표",
    "SPOTV", "SPOTV NOW 편성표", "쿠팡플레이", "쿠팡플레이 편성표",
    "티빙", "티빙 스포츠", "Apple TV+ 스포츠", "한해설",
    "tvN SPORTS 편성표", "KBS N SPORTS 편성표", "MBC SPORTS+ 편성표", "SBS Sports 편성표",
    "실시간 중계", "무료 축구", "무료 중계", "스포츠 무료 중계", "스포츠 중계",
  ],
  openGraph: {
    title: "한해설 - 스포츠 한국어 해설 편성표",
    description:
      "축구, 야구, 농구, 배구 한국어 해설 중계 편성표. 10개 플랫폼의 스포츠 중계를 한눈에.",
    url: "https://중계.kro.kr",
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [
      {
        url: "https://중계.kro.kr/logo.png",
        alt: "한해설 로고",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "한해설 - 스포츠 한국어 해설 편성표",
    description:
      "축구, 야구, 농구, 배구 한국어 해설 중계 편성표. 10개 플랫폼의 스포츠 중계를 한눈에.",
  },
  alternates: {
    canonical: "https://중계.kro.kr",
  },
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icon.png",
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
        <script async src="https://www.googletagmanager.com/gtag/js?id=G-F1MX6S0SGW" />
        <script
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', 'G-F1MX6S0SGW');`,
          }}
        />
        <meta name="msvalidate.01" content="BAF456457E39D2FDB1A54BF8674FA2C6" />
        <meta name="google-site-verification" content="qe2Z2hjBEFJqqq_nEcLigG8aEiQdotP4_6jouBXE5aE" />
        <meta name="naver-site-verification" content="811aafee6d2d5ad9a70897014beead430df91ade" />
        <meta name="google-adsense-account" content="ca-pub-3233121387897003" />
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
                  "url": "https://중계.kro.kr",
                  "description": "축구, 야구, 농구, 배구 한국어 해설 중계 편성표. 10개 플랫폼의 스포츠 중계를 한눈에 확인하세요.",
                  "inLanguage": "ko",
                },
                {
                  "@type": "Organization",
                  "name": "한해설",
                  "url": "https://중계.kro.kr",
                  "logo": "https://중계.kro.kr/icon.png",
                },
              ],
            }),
          }}
        />
      </head>
      <body className={`${geistSans.variable} antialiased`}>{children}</body>
    </html>
  );
}

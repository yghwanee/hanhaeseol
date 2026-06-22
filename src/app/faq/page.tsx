import type { Metadata } from "next";
import { CoupangTopBannerOnly } from "../_components/CoupangBanners";
import { SiteHeader } from "../_components/SiteHeader";

export const metadata: Metadata = {
  title: "자주 묻는 질문 - 한국어 해설 중계 편성표 | 한해설",
  description:
    "한국어 해설 중계, 한국어 중계 편성표에 대한 자주 묻는 질문. EPL·MLB·KBO·K리그 등 한국어해설 시청 방법, 쿠팡플레이·티빙·SPOTV NOW 등 플랫폼별 차이, 한해설 데이터 갱신 주기 안내.",
  keywords: [
    "한국어 해설",
    "한국어해설",
    "한국어 중계",
    "한국어중계",
    "한국어 해설 중계",
    "스포츠 한국어 해설",
    "EPL 한국어 중계",
    "MLB 한국어 중계",
    "KBO 한국어 중계",
    "쿠팡플레이 편성표",
    "티빙 스포츠",
    "SPOTV NOW",
    "FAQ",
    "한해설",
  ],
  alternates: { canonical: "https://haeseol.com/faq" },
  openGraph: {
    title: "자주 묻는 질문 - 한해설",
    description:
      "한국어 해설 중계와 한국어 중계 편성표에 대한 자주 묻는 질문 모음.",
    url: "https://haeseol.com/faq",
    siteName: "한해설",
    locale: "ko_KR",
    type: "website",
    images: [{ url: "/og-default.png", width: 1200, height: 630, alt: "한해설 FAQ" }],
  },
};

interface FaqItem {
  question: string;
  answer: string;
}

const FAQS: FaqItem[] = [
  {
    question: "한국어 해설 중계가 무엇인가요?",
    answer:
      "한국어 해설 중계는 해외 또는 국내 스포츠 경기를 한국어 캐스터·해설위원이 실시간으로 중계하는 방송을 말합니다. 같은 경기라도 플랫폼에 따라 한국어 해설을 제공하기도 하고 현지 영어·일본어·스페인어 해설만 제공하기도 합니다. 한해설은 각 경기마다 한국어 해설 제공 여부를 초록(한국어해설)·빨강(현지해설)·노랑(확인중) 뱃지로 표시합니다.",
  },
  {
    question: "EPL 한국어 중계는 어디서 볼 수 있나요?",
    answer:
      "EPL(잉글랜드 프리미어리그)은 시즌·라운드에 따라 쿠팡플레이, SPOTV NOW, SPOTV, SPOTV2 등에서 한국어 해설 중계를 제공합니다. 한해설 메인 페이지에서 종목을 축구, 리그 필터에 프리미어리그를 선택하면 해당 라운드의 모든 한국어 중계 일정을 한눈에 확인할 수 있습니다.",
  },
  {
    question: "MLB 한국어 중계 편성은 어떻게 되나요?",
    answer:
      "MLB(메이저리그)는 쿠팡플레이, 티빙, SPOTV NOW 등에서 한국어 해설을 제공합니다. 특히 한국 선수가 출전하는 경기는 대부분 한국어 중계가 편성됩니다. 한해설 편성표에서 종목을 야구로 선택하면 오늘부터 7일치 MLB 한국어 중계 편성을 확인할 수 있습니다.",
  },
  {
    question: "쿠팡플레이, 티빙, SPOTV NOW의 차이는 무엇인가요?",
    answer:
      "쿠팡플레이는 K리그·MLS·EPL·UFC 등 종목별 독점 중계가 강점이고, 티빙은 KBO 단독 중계와 일부 해외 축구를 제공합니다. SPOTV NOW는 EPL·라리가·세리에A·분데스리가·MLB·NBA 등 유럽 축구와 미국 프로 스포츠 한국어 해설 중계가 많습니다. 한해설에서는 한 페이지에서 10개 플랫폼의 한국어 중계 편성표를 동시에 비교할 수 있습니다.",
  },
  {
    question: "한국어 해설과 현지 해설의 차이는 무엇인가요?",
    answer:
      "한국어 해설은 한국인 캐스터·해설위원이 한국어로 진행하는 중계이고, 현지 해설은 경기가 열리는 국가의 언어(영어, 스페인어, 일본어 등)로 진행되는 중계입니다. 같은 플랫폼이라도 경기에 따라 한국어 해설을 제공하지 않고 현지 해설만 송출하는 경우가 있어, 한해설은 경기마다 해설 유형을 명확히 구분해 표시합니다.",
  },
  {
    question: "한해설 편성표는 얼마나 자주 업데이트되나요?",
    answer:
      "한해설 편성표는 매일 자동으로 갱신됩니다. 각 플랫폼의 공식 편성표를 크롤링해 오늘부터 7일치 일정을 업데이트하고, 페이지 하단의 '마지막 업데이트' 시각으로 최신 갱신 시점을 확인할 수 있습니다. 다만 실시간 변경(중계 취소, 시간 변동)은 반영이 지연될 수 있어 정확한 시청 정보는 각 플랫폼 공지를 함께 확인하시길 권장합니다.",
  },
  {
    question: "한해설은 어떤 종목과 리그를 다루나요?",
    answer:
      "축구(EPL·라리가·세리에A·분데스리가·리그1·챔피언스리그·유로파리그·K리그·MLS·AFC·사우디 등), 야구(MLB·KBO), 농구(NBA·KBL·B.League), 배구(V리그) 네 가지 종목의 한국어 중계 편성표를 제공합니다. 종목·리그·플랫폼·해설 유형으로 필터링해 원하는 경기만 골라 볼 수 있습니다.",
  },
  {
    question: "한해설을 이용하는 데 비용이 드나요?",
    answer:
      "한해설 서비스 자체는 무료로 이용할 수 있습니다. 다만 표시되는 경기를 실제로 시청하려면 각 OTT(SPOTV NOW, 쿠팡플레이, 티빙, Apple TV+) 또는 TV 채널(SPOTV·SPOTV2·tvN SPORTS·KBS N SPORTS·MBC SPORTS+·SBS Sports)의 구독·시청 권한이 필요합니다.",
  },
];

export default function FaqPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };

  return (
    <main className="min-h-screen text-gray-100">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="mx-auto max-w-2xl px-3 pb-8 text-[14px] sm:px-4 sm:pb-12">
        <SiteHeader />

        <h1 className="mt-4 sm:mt-6 mb-2 text-2xl font-bold sm:text-3xl">자주 묻는 질문</h1>
        <p className="mb-8 text-sm text-zinc-400">
          한국어 해설 중계, 한국어 중계 편성표 이용에 대해 자주 들어오는 질문을 모았습니다.
        </p>

        <CoupangTopBannerOnly />

        <div className="space-y-6">
          {FAQS.map((faq, i) => (
            <section key={i} className="rounded-lg border border-zinc-800/80 bg-zinc-900/30 p-4 sm:p-5">
              <h2 className="mb-2 text-base font-semibold text-zinc-100 sm:text-lg">
                Q. {faq.question}
              </h2>
              <p className="text-sm leading-relaxed text-zinc-300 sm:text-[15px]">
                {faq.answer}
              </p>
            </section>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-zinc-500">
          답변이 충분하지 않다면{" "}
          <a href="mailto:yghwanee@gmail.com" className="text-blue-400 hover:underline">
            yghwanee@gmail.com
          </a>
          으로 문의해 주세요.
        </p>
      </div>
    </main>
  );
}

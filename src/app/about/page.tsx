import type { Metadata } from "next";
import Link from "next/link";
import { CoupangTopBannerOnly } from "../_components/CoupangBanners";
import { SiteHeader } from "../_components/SiteHeader";

export const metadata: Metadata = {
  title: "한해설 소개 - 스포츠 한국어 해설·한국어 중계 편성표 서비스",
  description:
    "한해설은 SPOTV NOW, 쿠팡플레이, 티빙 등 10개 스포츠 중계 플랫폼의 편성표를 한 페이지에 모아, 한국어 해설 중계와 한국어 중계 편성을 한눈에 확인할 수 있는 무료 편성표 서비스입니다.",
  keywords: [
    "한해설",
    "한해설 소개",
    "한국어 해설",
    "한국어해설",
    "한국어 중계",
    "한국어중계",
    "한국어 해설 중계",
    "스포츠 편성표",
    "스포츠 중계 편성표",
  ],
  alternates: { canonical: "https://haeseol.com/about" },
};

export default function AboutPage() {
  return (
    <main className="min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pb-8 sm:pb-12 text-[14px]">
        <SiteHeader />

        <h1 className="text-2xl sm:text-3xl font-bold mt-4 sm:mt-6 mb-8">한해설 소개</h1>

        <CoupangTopBannerOnly />


        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">한해설이란?</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            한해설은 <strong>스포츠 한국어 해설 중계 편성표</strong>를 한곳에 모아 보여주는 무료 서비스입니다.
            여러 OTT와 TV 채널에 흩어져 있는 스포츠 중계 일정을 한 번에 확인하고,
            특히 <strong>한국어 해설이 제공되는 경기</strong>를 쉽게 찾을 수 있도록 설계되었습니다.
          </p>
          <p className="text-gray-300 leading-relaxed">
            EPL·라리가·세리에A·분데스리가·챔피언스리그·MLB·KBO·NBA·K리그 등 주요 스포츠의
            <strong> 한국어 중계 편성표</strong>를 SPOTV NOW, 쿠팡플레이, 티빙, Apple TV+, SPOTV, SPOTV2,
            tvN SPORTS, KBS N SPORTS, MBC SPORTS+, SBS Sports 등 10개 플랫폼에서 매일 자동 수집해 정리합니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">한국어 해설이 왜 중요할까?</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            같은 경기라도 플랫폼에 따라 <strong>한국어 해설 중계</strong>가 있을 수도 있고, 현지 영어·일본어·스페인어 해설만 송출되는 경우도 있습니다.
            특히 EPL, 라리가, MLB처럼 해외에서 열리는 경기는 어느 채널이 한국어 해설을 붙였는지 사전에 알기 어렵습니다.
          </p>
          <p className="text-gray-300 leading-relaxed">
            한해설은 경기마다 <strong>한국어해설 여부</strong>를 초록·빨강·노랑 뱃지로 명확히 구분해, 한국어 중계가 가능한 경기만 골라보거나
            여러 플랫폼의 한국어 중계 일정을 비교해 가장 편한 시청 환경을 선택할 수 있게 도와줍니다.
          </p>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">지원 종목</h2>
          <ul className="text-gray-300 space-y-1 list-disc list-inside">
            <li>축구 (EPL, 라리가, 분데스리가, 세리에A, 리그1, K리그, AFC 등)</li>
            <li>야구 (MLB, KBO)</li>
            <li>농구 (NBA, KBL)</li>
            <li>배구 (V리그)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">지원 플랫폼</h2>
          <div className="grid grid-cols-2 gap-2 text-gray-300">
            <div>
              <p className="font-medium text-gray-100 mb-1">OTT</p>
              <ul className="space-y-1 list-disc list-inside text-sm">
                <li>SPOTV NOW</li>
                <li>쿠팡플레이</li>
                <li>티빙</li>
                <li>Apple TV+</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-gray-100 mb-1">TV 채널</p>
              <ul className="space-y-1 list-disc list-inside text-sm">
                <li>SPOTV / SPOTV2</li>
                <li>tvN SPORTS</li>
                <li>KBS N SPORTS</li>
                <li>MBC SPORTS+</li>
                <li>SBS Sports</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">해설 표시 안내</h2>
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-green-900 text-green-300 text-xs font-medium">한국어해설</span>
              <span className="text-gray-300">한국어 해설이 제공되는 경기</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-red-900 text-red-300 text-xs font-medium">현지해설</span>
              <span className="text-gray-300">현지 언어(영어 등) 해설로 제공되는 경기</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-yellow-900 text-yellow-300 text-xs font-medium">확인중</span>
              <span className="text-gray-300">해설 정보를 아직 확인하지 못한 경기</span>
            </div>
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">데이터 업데이트</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            한국어 중계 편성표 데이터는 매일 자동으로 갱신되며, 오늘부터 7일치 일정을 제공합니다.
            각 플랫폼의 공식 편성표를 기반으로 하며, 실시간 변경(중계 취소, 시간 변경)은 반영이 지연될 수 있어
            정확한 시청 정보는 각 플랫폼 공지를 함께 확인하시길 권장합니다.
          </p>
          <p className="text-gray-300 leading-relaxed">
            <Link href="/faq" className="text-blue-400 hover:underline">자주 묻는 질문</Link>에서
            한국어 해설 중계와 한국어 중계 편성표 이용에 대한 더 자세한 안내를 확인할 수 있습니다.
          </p>
        </section>

        {/* 생성 방식 공개.
            Google 의 helpful-content 가이드는 "Who / How / Why" 세 질문을 평가 항목으로 두고,
            **AI 보조 콘텐츠에는 과정 공개를 기대한다**고 명시한다(그리고 그게 정직하다).
            사이트 전체가 어떻게 만들어지는지를 한곳에서 밝힌다. 글마다 다른 주장을 붙이려면
            글마다 확인이 필요한데, 지금 기존 글에는 그 근거가 없어서 사이트 단위로 적는다. */}
        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">이 사이트가 만들어지는 방식</h2>
          <p className="text-gray-300 leading-relaxed mb-3">
            편성표·순위·경기 결과는 각 플랫폼과 리그의 공개 정보를 프로그램이 자동으로
            수집·정규화한 것입니다. 사람이 일정을 손으로 입력하지 않습니다.
          </p>
          <p className="text-gray-300 leading-relaxed mb-3">
            경기 페이지의 <strong className="text-gray-100">경기 미리보기</strong>는 수집된
            기록을 근거로 AI가 작성한 자동 생성 문장이며, 각 문장을 사람이 따로 검수하지는
            않습니다. 해당 섹션에 생성 시점과 함께 표시됩니다.
          </p>
          <p className="text-gray-300 leading-relaxed">
            <Link href="/guide" className="text-blue-400 hover:underline">한해설 Topic</Link>{" "}
            글은 사람이 쓴 글과 AI가 초안을 작성한 글이 함께 있습니다. 어느 쪽이든 발행 전
            자동 검사(빌드·문체 검사)를 통과해야 하며, 사실관계가 확인되지 않은 내용은
            본문에 그렇게 표기합니다. 오류를 발견하면 아래로 알려주시면 고칩니다.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-3">문의</h2>
          <p className="text-gray-300">
            오류 제보나 문의 사항은{" "}
            <a href="mailto:yghwanee@gmail.com" className="text-blue-400 hover:underline">
              yghwanee@gmail.com
            </a>
            으로 연락해 주세요.
          </p>
        </section>
      </div>
    </main>
  );
}

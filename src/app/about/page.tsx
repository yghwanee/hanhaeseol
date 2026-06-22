import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { CoupangTopBannerOnly } from "../_components/CoupangBanners";
import { StickyHeader } from "../_components/StickyHeader";

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
        <StickyHeader>
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-end">
              <Image src="/icon.png" alt="한해설 아이콘" width={32} height={32} className="h-6 w-6 sm:h-8 sm:w-8 self-center" />
              <span className="ml-1 sm:ml-2 text-xl sm:text-3xl font-bold text-white">한해설</span>            </Link>
            <Link href="/" className="btn-caps-stripe inline-flex items-center justify-center whitespace-nowrap px-4 py-1.5 text-[11px] font-medium sm:px-5 sm:py-2 sm:text-xs">
              ← &ensp;편성표
            </Link>
          </header>
        </StickyHeader>

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

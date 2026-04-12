import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "한해설 소개 - 스포츠 한국어 해설 편성표",
  description: "한해설은 10개 스포츠 중계 플랫폼의 편성표를 모아 한국어 해설 여부를 한눈에 확인할 수 있는 서비스입니다.",
};

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-gray-950 text-gray-100">
      <div className="max-w-2xl mx-auto px-4 py-12">
        <Link href="/" className="text-blue-400 hover:underline text-sm mb-8 inline-block">← 편성표로 돌아가기</Link>

        <h1 className="text-3xl font-bold mb-8">한해설 소개</h1>

        <section className="mb-8">
          <h2 className="text-xl font-semibold mb-3">한해설이란?</h2>
          <p className="text-gray-300 leading-relaxed">
            한해설은 <strong>스포츠 한국어 해설 중계 편성표</strong>를 한곳에 모아 보여주는 서비스입니다.
            여러 OTT와 TV 채널에 흩어져 있는 스포츠 중계 일정을 한 번에 확인하고,
            특히 <strong>한국어 해설이 제공되는 경기</strong>를 쉽게 찾을 수 있습니다.
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
          <p className="text-gray-300 leading-relaxed">
            편성표 데이터는 매일 자동으로 수집되며, 오늘부터 7일간의 일정을 제공합니다.
            각 플랫폼의 공식 편성표를 기반으로 하며, 실시간 변경 사항은 반영이 지연될 수 있습니다.
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

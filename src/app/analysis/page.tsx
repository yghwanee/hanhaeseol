import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import fs from "fs";
import path from "path";
import { AnalysisData } from "@/types/analysis";
import AnalysisClient from "./AnalysisClient";
import { StickyHeader } from "../_components/StickyHeader";
import { CoupangTopBanner } from "../_components/CoupangBanners";

export const metadata: Metadata = {
  title: "해외 픽스터 분석글 - 한해설",
  description: "해외 스포츠 픽스터들의 경기 분석글을 번역하여 제공합니다.",
};

function loadAnalysisData(): AnalysisData {
  try {
    const filePath = path.join(process.cwd(), "src/data/analysis.json");
    return JSON.parse(fs.readFileSync(filePath, "utf-8"));
  } catch {
    return { lastUpdated: "", articles: [] };
  }
}

export default function AnalysisPage() {
  const data = loadAnalysisData();

  return (
    <main className="min-h-screen text-gray-100">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 pb-8 sm:pb-12">
        <StickyHeader>
          <header className="flex items-center justify-between">
            <Link href="/" className="flex items-end">
              <Image src="/icon.png" alt="한해설 아이콘" width={32} height={32} className="h-6 w-6 sm:h-8 sm:w-8 self-center" />
              <span className="ml-1 sm:ml-2 text-xl sm:text-3xl font-bold text-white">한해설</span>
              <span className="ml-2 sm:ml-3 text-sm sm:text-lg font-normal text-zinc-500">한국어중계 편성표</span>
            </Link>
            <Link href="/" className="text-[11px] sm:text-xs px-4 py-1.5 sm:px-5 sm:py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors whitespace-nowrap">
              ← 편성표
            </Link>
          </header>
        </StickyHeader>

        <div className="mt-4 sm:mt-6 mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-white">해외 픽스터 분석글</h1>
          <p className="mt-2 text-sm text-zinc-400 leading-relaxed">해외 유명 스포츠 분석가들의 경기 분석을 제공합니다.</p>
        </div>

        <CoupangTopBanner />

        <AnalysisClient articles={data.articles} lastUpdated={data.lastUpdated} />
      </div>
    </main>
  );
}

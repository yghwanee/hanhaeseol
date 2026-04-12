import type { Metadata } from "next";
import Link from "next/link";
import fs from "fs";
import path from "path";
import { AnalysisData } from "@/types/analysis";
import AnalysisClient from "./AnalysisClient";

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
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-8 sm:py-12">
        <Link href="/" className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 mb-6 rounded-lg border border-zinc-700 text-zinc-300 hover:border-zinc-500 hover:text-white transition-colors">
          ← 편성표로 돌아가기
        </Link>

        <h1 className="text-2xl sm:text-3xl font-bold mb-2">해외 픽스터 분석글</h1>
        <p className="text-zinc-500 text-xs sm:text-sm mb-6">
          해외 유명 스포츠 분석가들의 경기 분석을 제공합니다. <span className="text-zinc-600">(한국어 해설이 제공되는 경기에 한함)</span>
        </p>

        <AnalysisClient articles={data.articles} lastUpdated={data.lastUpdated} />
      </div>
    </main>
  );
}

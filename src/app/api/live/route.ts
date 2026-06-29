import { crawlLiveResults } from "@/lib/results/naver";

// 라이브 스코어 핫패스. 매 요청 실행하되 엣지 CDN에서 30초 캐시 →
// 시청자가 몇 명이든 원본 함수는 30초당 1회만 실행(비용 상수화). /api/emblem과 동일 캐시 패턴.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const data = await crawlLiveResults();
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=30, stale-while-revalidate=60",
      },
    });
  } catch {
    // 네이버 장애 시에도 클라가 깨지지 않도록 빈 결과 + 짧은 캐시로 폴백.
    return new Response(
      JSON.stringify({ lastUpdated: new Date().toISOString(), byKey: {}, results: [] }),
      {
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=15",
        },
      },
    );
  }
}

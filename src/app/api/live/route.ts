import { crawlLiveResults } from "@/lib/results/naver";

// 라이브 스코어 핫패스. 매 요청 실행하되 엣지 CDN에서 캐시 →
// 시청자가 몇 명이든 원본 함수는 TTL당 1회만 실행(비용 상수화). /api/emblem과 동일 캐시 패턴.
//
// 🔴 s-maxage 는 **클라 폴링 간격(45초)보다 길어야** 한다. 30초였을 때는 다음 폴링이
// 올 때마다 이미 만료돼 있어 한 명이 봐도 사실상 매번 원본을 때렸다(캐시가 일을 안 함).
// 60초로 올려 연속 폴링이 캐시에 맞게 했다. 데이터는 최대 60초 늦지만 스코어 표시엔 충분.
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  try {
    const data = await crawlLiveResults();
    return new Response(JSON.stringify(data), {
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=180",
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

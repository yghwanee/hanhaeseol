import { naverFetch } from "@/lib/naver-fetch";

// 임시 진단 경로 (2026-11-01). 확인 후 삭제한다.
export const dynamic = "force-dynamic";

const URL_ = "https://api-gw.sports.naver.com/schedule/games?categoryId=kbl&fromDate=2026-11-01&toDate=2026-11-01&size=5";
const HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent":
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

async function probe(name: string, run: () => Promise<Response>) {
  const t = Date.now();
  try {
    const r = await run();
    return { name, status: r.status, ms: Date.now() - t, body: (await r.text()).slice(0, 200) };
  } catch (e) {
    const err = e as Error & { cause?: { code?: string; message?: string }; code?: string };
    return { name, ms: Date.now() - t, error: err.name, message: err.message, code: err.code ?? err.cause?.code };
  }
}

export async function GET(): Promise<Response> {
  const results = await Promise.all([
    probe("tls12", () => naverFetch(URL_, { headers: HEADERS, signal: AbortSignal.timeout(8000) })),
    // fetch-cache-ok: 임시 진단
    probe("fetch", () => fetch(URL_, { headers: HEADERS, signal: AbortSignal.timeout(8000), cache: "no-store" })),
  ]);
  return Response.json({ region: process.env.VERCEL_REGION, node: process.version, results });
}

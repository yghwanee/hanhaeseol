import { writeRelayedLive } from "@/lib/live-relay";
import type { ResultsData } from "@/types/results";

// 집 PC 라이브 중계기(src/scripts/live-relay.ts)가 스코어를 올리는 곳. 인증은 dispatch 와 같은 키.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  const key = process.env.PUSH_TEST_KEY;
  if (!key || request.headers.get("x-push-key") !== key) {
    return Response.json({ ok: false }, { status: 401 });
  }
  const data = (await request.json().catch(() => null)) as ResultsData | null;
  if (!data || !Array.isArray(data.results) || typeof data.byKey !== "object") {
    return Response.json({ ok: false }, { status: 400 });
  }
  await writeRelayedLive(data);
  return Response.json({ ok: true, results: data.results.length });
}

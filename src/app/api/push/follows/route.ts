import { readSubscription, saveSubscription } from "@/lib/push/store";

/**
 * 찜 목록만 갱신하는 경량 입구. **`navigator.sendBeacon` 전용**이다.
 *
 * 🔴 왜 `/api/push/subscribe` 로 안 보내는가 — beacon 은 페이지가 사라지는 순간(pagehide)
 * 에 쏘는 마지막 한 발이라 **await 를 쓸 수 없다.** 그 시점에 `getSubscription()` 을
 * 기다릴 수 없으므로 구독 키(p256dh·auth)를 실을 방법이 없다. 그래서 여기서는
 * endpoint 로 기존 저장본을 찾아 **찜 목록만** 갈아끼운다.
 *
 * 이게 없으면 별을 풀고 바로 탭을 닫은 사람의 해제가 600ms 디바운스와 함께 사라지고,
 * 서버는 옛 찜으로 알림을 계속 보낸다(2026-09-15 "찜 다 풀었는데 푸시가 계속 와").
 *
 * 🔴 모르는 endpoint 는 **조용히 넘긴다**(200). beacon 은 응답을 못 읽으므로 상태코드로
 * 할 수 있는 게 없고, 여기서 새 저장본을 만들면 구독 키 없는 껍데기가 생긴다.
 */
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { endpoint?: unknown; follows?: unknown };
    if (typeof body?.endpoint !== "string" || !body.endpoint) {
      return Response.json({ ok: false, error: "missing endpoint" }, { status: 400 });
    }
    const follows = Array.isArray(body.follows)
      ? body.follows.filter((x): x is string => typeof x === "string")
      : [];
    const existing = await readSubscription(body.endpoint);
    if (!existing) return Response.json({ ok: true, skipped: "unknown endpoint" });
    await saveSubscription(existing.subscription, follows);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

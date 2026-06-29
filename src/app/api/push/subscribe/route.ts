import { saveSubscription } from "@/lib/push/store";

// 웹푸시 구독 등록. 클라가 PushSubscription(+찜한 팀)을 POST → 저장소에 upsert.
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      follows?: unknown;
    };
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return Response.json({ ok: false, error: "invalid subscription" }, { status: 400 });
    }
    const follows = Array.isArray(body?.follows)
      ? body.follows.filter((x): x is string => typeof x === "string")
      : [];
    await saveSubscription(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      follows,
    );
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

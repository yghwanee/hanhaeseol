import { removeSubscription, saveSubscription } from "@/lib/push/store";

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

/**
 * 구독 해제. 클라가 endpoint 만 보내면 저장소에서 지운다.
 *
 * 🔴 **알림 권한은 코드로 되돌릴 수 없다.** 한 번 `granted` 면 브라우저 설정에서만 바꿀 수
 * 있다. 그래서 "끄기"는 권한을 뺏는 게 아니라 **이 구독을 지우는 것**이다 — 서버가 보낼
 * 대상에서 빠지므로 알림이 멈추고, 다시 켤 때는 권한 프롬프트 없이 바로 켜진다.
 * 토글이 양방향으로 매끄럽게 도는 이유가 이것이다.
 *
 * 🔴 없는 endpoint 를 지워도 성공으로 답한다. 클라가 로컬 구독을 이미 지운 뒤 이 호출이
 * 실패하면 화면은 "꺼짐"인데 서버는 계속 보내는 상태가 된다 — 되돌릴 수 없는 어긋남이다.
 */
export async function DELETE(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { endpoint?: string };
    if (!body?.endpoint || typeof body.endpoint !== "string") {
      return Response.json({ ok: false, error: "missing endpoint" }, { status: 400 });
    }
    await removeSubscription(body.endpoint);
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}

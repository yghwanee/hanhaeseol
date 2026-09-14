import { readSubscription, removeSubscription, saveSubscription } from "@/lib/push/store";

// 웹푸시 구독 등록. 클라가 PushSubscription(+찜한 팀)을 POST → 저장소에 upsert.
export const dynamic = "force-dynamic";

/**
 * 🔴 `previousEndpoint` — 같은 기기의 **이전 구독 주소**. 브라우저는 푸시 구독 주소를
 * 예고 없이 갈아끼운다(`pushsubscriptionchange`). 새 주소로만 저장하면 옛 주소의 저장본이
 * 옛 찜 목록을 든 채 남는다. 사용자가 찜을 다 풀어도 새 주소에만 `[]` 가 가고, 옛 주소로
 * 알림이 계속 나간다(2026-09-15 "찜 다 풀었는데 푸시가 계속 온다").
 * 그래서 새 주소를 저장한 **뒤** 옛 저장본을 지운다(반대 순서면 둘 다 잃을 수 있다).
 *
 * `follows` 가 없으면 옛 저장본의 찜을 옮겨 온다 — 서비스워커는 localStorage 를 못 읽어서
 * 주소 교체 이벤트에서 찜 목록 없이 이 라우트를 부른다.
 */
export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as {
      subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
      follows?: unknown;
      previousEndpoint?: unknown;
    };
    const sub = body?.subscription;
    if (!sub?.endpoint || !sub.keys?.p256dh || !sub.keys?.auth) {
      return Response.json({ ok: false, error: "invalid subscription" }, { status: 400 });
    }
    const previous =
      typeof body.previousEndpoint === "string" && body.previousEndpoint !== sub.endpoint
        ? body.previousEndpoint
        : null;
    const follows = Array.isArray(body?.follows)
      ? body.follows.filter((x): x is string => typeof x === "string")
      : previous
        ? ((await readSubscription(previous))?.follows ?? [])
        : [];
    await saveSubscription(
      { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth } },
      follows,
    );
    if (previous) await removeSubscription(previous);
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

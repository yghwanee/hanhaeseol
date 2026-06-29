import { listSubscriptions, removeSubscription } from "@/lib/push/store";
import { sendPush } from "@/lib/push/send";

// [A단계 검증용] 저장된 모든 구독에 테스트 푸시 1발. ?key=PUSH_TEST_KEY 로 보호(남용 방지).
// 실서비스 발송(시작·결과·골)은 C·D단계에서 GitHub Actions로 옮긴다. 그때 이 라우트는 제거.
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const key = new URL(request.url).searchParams.get("key");
  if (!process.env.PUSH_TEST_KEY || key !== process.env.PUSH_TEST_KEY) {
    return Response.json({ ok: false }, { status: 403 });
  }
  let sent = 0;
  let removed = 0;
  const subs = await listSubscriptions();
  for (const s of subs) {
    const r = await sendPush(s.subscription, {
      title: "한해설 테스트 알림",
      body: "푸시가 정상 작동합니다 ⚽",
      url: "/",
      tag: "hhs-test",
    });
    if (r.ok) sent++;
    else if (r.gone) {
      await removeSubscription(s.subscription.endpoint);
      removed++;
    }
  }
  return Response.json({ ok: true, total: subs.length, sent, removed });
}

// web-push로 실제 푸시 발송. VAPID 키는 환경변수에서.
import webpush from "web-push";

let configured = false;
function configure(): void {
  if (configured) return;
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@haeseol.com";
  if (!pub || !priv) throw new Error("VAPID keys not configured");
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
}

export interface PushPayload {
  title: string;
  body?: string;
  url?: string;
  tag?: string;
}

/** 단건 발송. gone=true면 만료된 구독(404/410) → 호출측에서 삭제 권장. */
export async function sendPush(
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload,
): Promise<{ ok: boolean; gone?: boolean }> {
  configure();
  try {
    await webpush.sendNotification(
      sub as webpush.PushSubscription,
      JSON.stringify(payload),
    );
    return { ok: true };
  } catch (e: unknown) {
    const code = (e as { statusCode?: number }).statusCode;
    if (code === 404 || code === 410) return { ok: false, gone: true };
    return { ok: false };
  }
}

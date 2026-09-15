"use client";

/**
 * 브라우저 쪽 푸시 구독 조작 — **한 곳에 모은다.**
 *
 * 🔴 종전에는 이 로직이 `PushSubscribeButton` 안에만 있었다. 그래서 그 버튼이 화면에서
 * 사라지면(푸터에서 뺐거나, 찜이 0개가 돼 「내 팀」 섹션이 통째로 없어지면) **찜 변경을
 * 서버에 알릴 주체가 같이 사라졌다.** 알림이 안 멈추는 고장의 절반이 여기서 났다
 * (2026-09-15 작업121). 버튼과 동기화는 수명이 다른 일이므로 분리한다.
 */

const VAPID = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** 이 기기가 서버에 마지막으로 올린 구독 주소. 주소가 바뀌면 옛 저장본을 지우게 하려고 둔다. */
const ENDPOINT_KEY = "hhs.push.endpoint.v1";

/**
 * 마지막으로 서버에 찜을 올린 시각. **하트비트**의 기준이다.
 *
 * 🔴 서버는 오래 갱신 없는 구독을 발송에서 뺀다(`STALE_SUB_DAYS`) — 스스로 못 지우는
 * 유령이 영구히 사는 걸 막는 상한이다. 그런데 찜이 안 바뀌는 사람은 서버 쓰기가 아예
 * 안 나가므로 그 상한이 **멀쩡한 구독까지** 자른다. 그래서 찜이 그대로여도 주 1회는
 * 올려 살아 있다고 알린다(구독자당 주 1회 쓰기라 비용은 없다).
 */
const SYNCED_AT_KEY = "hhs.push.syncedAt.v1";
const HEARTBEAT_MS = 7 * 24 * 60 * 60 * 1000;

/** 구독 상태가 바뀐 순간 화면의 다른 컨트롤에 알린다(버튼이 여러 곳에 걸려 있다). */
export const PUSH_SUB_EVENT = "hhs:push-sub";

export function pushConfigured(): boolean {
  return Boolean(VAPID);
}

export function readStoredEndpoint(): string | null {
  try {
    return localStorage.getItem(ENDPOINT_KEY);
  } catch {
    return null;
  }
}

export function writeStoredEndpoint(endpoint: string | null): void {
  try {
    if (endpoint) localStorage.setItem(ENDPOINT_KEY, endpoint);
    else localStorage.removeItem(ENDPOINT_KEY);
  } catch {
    /* 저장 불가 환경 — 주소 교체 정리는 서비스워커 이벤트에 맡긴다 */
  }
}

export function markSynced(): void {
  try {
    localStorage.setItem(SYNCED_AT_KEY, String(Date.now()));
  } catch {
    /* 저장 불가 환경 — 하트비트를 못 세면 매번 올린다(해가 없다) */
  }
}

export function heartbeatDue(): boolean {
  try {
    const at = Number(localStorage.getItem(SYNCED_AT_KEY));
    return !Number.isFinite(at) || at <= 0 || Date.now() - at > HEARTBEAT_MS;
  } catch {
    return true;
  }
}

/** 이 브라우저에서 푸시 구독이 아예 불가능한가. */
export function pushUnavailable(): boolean {
  return (
    typeof window === "undefined" ||
    !VAPID ||
    !("serviceWorker" in navigator) ||
    !("PushManager" in window)
  );
}

export async function currentSubscription(): Promise<PushSubscription | null> {
  if (pushUnavailable()) return null;
  try {
    const reg = await navigator.serviceWorker.ready;
    return await reg.pushManager.getSubscription();
  } catch {
    return null;
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

/**
 * 찜 목록을 서버에 올린다. 구독이 없으면 아무것도 안 하고 false.
 *
 * 🔴 `previousEndpoint` — 브라우저가 구독 주소를 갈아끼웠으면 옛 주소를 같이 알려 지우게
 * 한다. 안 그러면 옛 저장본이 옛 찜을 든 채 알림을 계속 받는다.
 */
export async function putFollows(list: string[]): Promise<boolean> {
  const sub = await currentSubscription();
  if (!sub) return false;
  const previous = readStoredEndpoint();
  const res = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      subscription: sub.toJSON(),
      follows: list,
      ...(previous && previous !== sub.endpoint ? { previousEndpoint: previous } : {}),
    }),
  });
  if (res.ok) {
    writeStoredEndpoint(sub.endpoint);
    markSynced();
  }
  return res.ok;
}

/**
 * 페이지가 사라지는 순간 찜 목록을 흘려보낸다.
 *
 * 🔴 재동기에는 디바운스가 걸려 있어(별 연타에 쓰기가 그만큼 나가는 걸 막는다) 별을 풀고
 * 바로 탭을 닫으면 그 타이머가 취소돼 **해제가 영영 서버에 안 간다.** `pagehide` 에서는
 * `fetch` 가 끊기므로 `sendBeacon` 을 쓰고, beacon 은 await 가 안 돼 구독 키를 실을 수
 * 없으므로 저장해 둔 endpoint 로 찜만 갈아끼우는 전용 라우트를 부른다.
 */
export function beaconFollows(list: string[]): boolean {
  const endpoint = readStoredEndpoint();
  if (!endpoint || typeof navigator === "undefined" || typeof navigator.sendBeacon !== "function") {
    return false;
  }
  try {
    const blob = new Blob([JSON.stringify({ endpoint, follows: list })], {
      type: "application/json",
    });
    if (navigator.sendBeacon("/api/push/follows", blob)) {
      markSynced();
      return true;
    }
  } catch {
    /* 떠나는 길이라 더 할 수 있는 게 없다 */
  }
  return false;
}

export type SubscribeOutcome = "subscribed" | "already" | "denied" | "unavailable" | "failed";

/**
 * 구독이 없으면 만든다. 이미 있으면 찜만 올린다.
 *
 * 🔴 `prompt:false` 는 **권한을 아직 안 물어본 상태에서는 아무것도 하지 않는다.** 별을
 * 누르는 순간 자동으로 켜는 경로(`use-follows`)가 이걸 쓴다 — 사용자 제스처 안에서만
 * 권한을 묻고, 이미 거절한 사람에게는 두 번 묻지 않는다(브라우저가 막기도 한다).
 */
export async function ensureSubscribed(
  follows: string[],
  opts: { prompt?: boolean } = {},
): Promise<SubscribeOutcome> {
  if (pushUnavailable()) return "unavailable";
  try {
    // 🔴 권한 요청을 **가장 먼저** 한다. 사파리는 `requestPermission` 이 사용자 제스처
    //    안에서 불려야 하는데, 앞에 `await` 가 하나라도 끼면 그 제스처가 만료된 것으로
    //    보고 조용히 거절한다. 별을 누르는 순간 켜지는 경로가 그래서 막힌다.
    if (Notification.permission === "denied") return "denied";
    if (Notification.permission !== "granted") {
      if (opts.prompt === false) return "unavailable";
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return perm === "denied" ? "denied" : "failed";
    }
    const existing = await currentSubscription();
    if (existing) {
      await putFollows(follows);
      return "already";
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID as string) as BufferSource,
    });
    const ok = await putFollows(follows);
    if (ok) window.dispatchEvent(new Event(PUSH_SUB_EVENT));
    return ok ? "subscribed" : "failed";
  } catch {
    return "failed";
  }
}

/**
 * 알림 끄기 = **구독 삭제**. 권한은 코드로 못 되돌린다(한 번 granted 면 브라우저 설정에서만).
 *
 * 🔴 **서버를 먼저 지우고 로컬 구독을 해제한다.** 반대 순서면 로컬을 지운 뒤 서버 삭제가
 * 실패했을 때 endpoint 를 잃어 **영영 지울 수 없는 유령 구독**이 남는다(화면은 꺼짐,
 * 알림은 계속 옴). 서버 삭제가 실패하면 아예 끄지 않는다.
 */
export async function unsubscribePush(): Promise<boolean> {
  const sub = await currentSubscription();
  if (!sub) {
    writeStoredEndpoint(null);
    return true;
  }
  try {
    const res = await fetch("/api/push/subscribe", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ endpoint: sub.endpoint }),
    });
    if (!res.ok) return false;
    await sub.unsubscribe().catch(() => {});
    writeStoredEndpoint(null);
    return true;
  } catch {
    return false;
  }
}

// 웹푸시 구독자 저장소. 기본 구현은 Vercel Blob(비공개).
// 구독 1건 = 파일 1건(경로 = endpoint의 sha256) → 동시 가입 충돌 없음, 갱신은 덮어쓰기.
// 저장소를 바꾸고 싶으면(예: GitHub 비공개 레포) 이 파일의 3개 함수만 교체하면 된다.
import { put, list, del, get } from "@vercel/blob";
import { createHash } from "crypto";

export interface PushSub {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}
export interface StoredSubscription {
  subscription: PushSub;
  /** 찜한 팀/리그 키 (B단계에서 채움. A에선 빈 배열). */
  follows: string[];
  createdAt: string;
}

const PREFIX = "push-subs/";
const hashOf = (endpoint: string) => createHash("sha256").update(endpoint).digest("hex");
const pathFor = (endpoint: string) => PREFIX + hashOf(endpoint) + ".json";

/**
 * 구독을 가리키는 짧은 id(엔드포인트 해시 앞 12자). 로그·운영 도구에 엔드포인트 원문을
 * 흘리지 않고 한 건을 집어 지우기 위한 것이다.
 */
export function subscriptionId(endpoint: string): string {
  return hashOf(endpoint).slice(0, 12);
}

/** 엔드포인트 하나의 저장본. 없거나 못 읽으면 null. */
export async function readSubscription(endpoint: string): Promise<StoredSubscription | null> {
  try {
    const res = await get(pathFor(endpoint), { access: "private" });
    if (!res?.stream) return null;
    const data = (await new Response(res.stream).json()) as StoredSubscription;
    return data?.subscription?.endpoint ? data : null;
  } catch {
    return null;
  }
}

/**
 * id(`subscriptionId`) 로 지운다. 운영자가 유령 구독을 치울 때만 쓴다.
 * 접두사가 정확히 하나에만 맞을 때만 지운다 — 짧은 id 가 둘에 걸리면 아무것도 안 한다.
 */
export async function removeSubscriptionById(id: string): Promise<boolean> {
  if (!/^[0-9a-f]{12}$/.test(id)) return false;
  const { blobs } = await list({ prefix: PREFIX + id });
  if (blobs.length !== 1) return false;
  await del(blobs[0].pathname);
  return true;
}

export async function saveSubscription(sub: PushSub, follows: string[] = []): Promise<void> {
  const data: StoredSubscription = {
    subscription: sub,
    follows,
    createdAt: new Date().toISOString(),
  };
  await put(pathFor(sub.endpoint), JSON.stringify(data), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

export async function removeSubscription(endpoint: string): Promise<void> {
  try {
    await del(pathFor(endpoint));
  } catch {
    /* 이미 없으면 무시 */
  }
}

export async function listSubscriptions(): Promise<StoredSubscription[]> {
  const { blobs } = await list({ prefix: PREFIX });
  const out: StoredSubscription[] = [];
  for (const b of blobs) {
    try {
      const res = await get(b.pathname, { access: "private" });
      if (!res?.stream) continue;
      const data = (await new Response(res.stream).json()) as StoredSubscription;
      // 🔴 `follows` 를 정규화해서 넣는다. 옛 스키마·수동 편집으로 이 필드가 없는
      // 블롭이 하나라도 있으면 `shouldReceive` 가 `follows.length` 에서 던져
      // **전 구독자 발송이 통째로 멈춘다.**
      if (data?.subscription?.endpoint) {
        out.push({
          ...data,
          follows: Array.isArray(data.follows)
            ? data.follows.filter((x): x is string => typeof x === "string")
            : [],
        });
      }
    } catch {
      /* 깨진 블롭은 건너뜀 */
    }
  }
  return out;
}

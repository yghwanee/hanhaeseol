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
const pathFor = (endpoint: string) =>
  PREFIX + createHash("sha256").update(endpoint).digest("hex") + ".json";

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
      if (data?.subscription?.endpoint) out.push(data);
    } catch {
      /* 깨진 블롭은 건너뜀 */
    }
  }
  return out;
}

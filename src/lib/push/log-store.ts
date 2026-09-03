import { put, get } from "@vercel/blob";

/**
 * 푸시 발송 기록. **중복 발송을 막는 단일 진실 원본**이다.
 *
 * 구독자 저장소와 같은 Blob 에 둔다. 레포 커밋(post-log 방식)을 안 쓰는 이유가 둘이다:
 *   ① 발송은 Vercel 라우트에서 도는데 거기엔 GitHub 토큰이 없다. 넣으면 시크릿이 하나 는다.
 *   ② `data/*.json` 은 매시 크롤이 갈아엎는다. 같은 브랜치에 초 단위로 쓰면 충돌만 는다.
 *
 * 🔴 기록은 **보낸 직후** 쓴다. 실행이 중간에 죽어도 이미 보낸 건 남아야 한다.
 * 소셜 삼중 게시(2026-09-02)가 정확히 이걸 안 해서 났다 — 판정을 "실행 이력"에 걸면
 * 동시에 깨어난 실행들이 전부 "아직 아무도 안 했다"를 본다.
 */

const LOG_PATH = "push-log/log.json";

/** 며칠 지난 기록은 버린다. 키 앞 10자가 경기 날짜다. */
export const RETAIN_DAYS = 5;

export interface PushLog {
  /** 이미 보낸 dedupKey → 보낸 시각(ISO). */
  sent: Record<string, string>;
  /** 경기별 마지막으로 알린 스코어("2-1"). 득점 감지의 기준선. */
  scores: Record<string, string>;
}

export const EMPTY_PUSH_LOG: PushLog = { sent: {}, scores: {} };

export function normalizePushLog(raw: unknown): PushLog {
  const o = (raw ?? {}) as Partial<PushLog>;
  return {
    sent: isRecord(o.sent) ? o.sent : {},
    scores: isRecord(o.scores) ? o.scores : {},
  };
}

function isRecord(v: unknown): v is Record<string, string> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

/** 키 앞 10자(경기 날짜)가 기준일보다 RETAIN_DAYS 이상 이전이면 버린다. */
export function prunePushLog(log: PushLog, today: string): PushLog {
  const cutoff = shiftDate(today, -RETAIN_DAYS);
  const keep = (k: string) => {
    const d = k.slice(0, 10);
    return !/^\d{4}-\d{2}-\d{2}$/.test(d) ? false : d >= cutoff;
  };
  return {
    sent: pick(log.sent, keep),
    scores: pick(log.scores, keep),
  };
}

function pick(
  src: Record<string, string>,
  keep: (k: string) => boolean,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(src)) if (keep(k)) out[k] = v;
  return out;
}

function shiftDate(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

export async function loadPushLog(): Promise<PushLog> {
  try {
    const res = await get(LOG_PATH, { access: "private" });
    if (!res?.stream) return { ...EMPTY_PUSH_LOG };
    return normalizePushLog(await new Response(res.stream).json());
  } catch {
    // 아직 없거나 깨졌으면 빈 기록. 🔴 여기서 던지면 발송 자체가 멈춘다.
    return { ...EMPTY_PUSH_LOG };
  }
}

export async function savePushLog(log: PushLog): Promise<void> {
  await put(LOG_PATH, JSON.stringify(log), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
  });
}

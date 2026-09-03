import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import { listSubscriptions, removeSubscription } from "@/lib/push/store";
import { sendPush } from "@/lib/push/send";
import { buildNotices, shouldReceive } from "@/lib/push/notify";
import {
  loadPushLog,
  prunePushLog,
  savePushLog,
  type PushLog,
} from "@/lib/push/log-store";
import { matchToSlug } from "@/lib/match-slug";
import { getTodayString } from "@/lib/schedule-utils";

/**
 * ⭐찜한 팀 경기 알림 발송.
 *
 * GitHub Actions 가 주기적으로 이 URL 을 때린다. 발송이 Vercel 에서 도는 이유는
 * 구독자·발송기록이 둘 다 Blob 에 있고 VAPID 비밀키도 여기에만 있기 때문이다.
 *
 * 🔴 자격증명이 없으면 **조용히 아무것도 안 한다**(에러가 아니다). 셋업 전에 워크플로가
 * 매번 빨개지면 진짜 고장을 못 알아본다.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ORIGIN = "https://haeseol.com";

export async function POST(request: Request): Promise<Response> {
  const key = process.env.PUSH_TEST_KEY;
  if (!key) return json({ ok: true, skipped: "PUSH_TEST_KEY 미설정" });
  if (request.headers.get("x-push-key") !== key) {
    return json({ ok: false, error: "unauthorized" }, 401);
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    return json({ ok: true, skipped: "VAPID 미설정" });
  }

  const dryRun = new URL(request.url).searchParams.get("dry") === "1";

  // 🔴 Blob 스토어가 없으면 구독자도 발송기록도 못 읽는다. 던지게 두면 워크플로가
  // 매시 빨개져서 진짜 고장을 못 알아본다. dry-run 은 저장소 없이도 돌게 둔다 —
  // 알림 문구를 실데이터로 확인하는 용도라 구독자가 필요 없다.
  const hasStore = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!hasStore && !dryRun) {
    return json({ ok: true, skipped: "Blob 스토어 미설정" });
  }

  const [schedules, results, subs, log] = await Promise.all([
    fetchSchedules(),
    fetchResults(),
    hasStore ? listSubscriptions().catch(() => []) : Promise.resolve([]),
    hasStore ? loadPushLog() : Promise.resolve({ sent: {}, scores: {} }),
  ]);

  // 구독자가 없으면 만들 필요도 없다. 단 dry-run 은 문구 확인이 목적이라 그대로 진행한다.
  if (subs.length === 0 && !dryRun) {
    return json({ ok: true, subscribers: 0, notices: 0, sent: 0 });
  }

  const notices = buildNotices({
    schedules,
    results,
    now: Date.now(),
    sent: new Set(Object.keys(log.sent)),
    lastScores: log.scores,
    matchUrl: (s: Schedule) => `/match/${encodeURIComponent(matchToSlug(s))}`,
  });

  if (notices.length === 0) {
    return json({ ok: true, subscribers: subs.length, notices: 0, sent: 0 });
  }
  if (dryRun) {
    return json({
      ok: true,
      dryRun: true,
      subscribers: subs.length,
      notices: notices.map((n) => ({ kind: n.kind, title: n.title, body: n.body })),
    });
  }

  const next: PushLog = { sent: { ...log.sent }, scores: { ...log.scores } };
  const now = new Date().toISOString();
  let sentCount = 0;
  const gone = new Set<string>();

  for (const notice of notices) {
    const targets = subs.filter((s) => shouldReceive(notice, s.follows));

    // 🔴 받는 사람이 없어도 **기록은 남긴다.** 안 그러면 같은 알림을 매 실행마다 다시
    // 만들고, 나중에 누가 그 팀을 찜하는 순간 지나간 경기의 알림이 한꺼번에 터진다.
    next.sent[notice.dedupKey] = now;
    if (notice.score) next.scores[notice.gameKey] = notice.score;

    for (const t of targets) {
      const res = await sendPush(t.subscription, {
        title: notice.title,
        body: notice.body,
        url: notice.url,
        tag: notice.tag,
      });
      if (res.ok) sentCount++;
      else if (res.gone) gone.add(t.subscription.endpoint);
    }
  }

  await savePushLog(prunePushLog(next, getTodayString()));
  // 만료된 구독은 지운다. 실패해도 발송 결과에는 영향 없다.
  await Promise.all([...gone].map((e) => removeSubscription(e).catch(() => {})));

  return json({
    ok: true,
    subscribers: subs.length,
    notices: notices.length,
    sent: sentCount,
    removed: gone.size,
  });
}

/**
 * 편성·결과는 배포된 정적 JSON 에서 읽는다.
 *
 * 🔴 `cache: "no-store"` 가 필수다. 없으면 Next Data Cache 가 붙잡아 그날 첫 스냅샷에
 * 하루 종일 동결된다(2026-07-15 에 `/api/live` 가 그렇게 죽어 있었다).
 */
async function fetchSchedules(): Promise<Schedule[]> {
  try {
    const res = await fetch(`${ORIGIN}/schedule.json`, { cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as ScheduleData;
    return Array.isArray(data?.schedules) ? data.schedules : [];
  } catch {
    return [];
  }
}

async function fetchResults(): Promise<ResultsData | null> {
  try {
    const res = await fetch(`${ORIGIN}/results.json`, { cache: "no-store" });
    if (!res.ok) return null;
    return (await res.json()) as ResultsData;
  } catch {
    return null;
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

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

/**
 * 🔴 편성·결과는 **레포 raw** 에서 읽는다. `haeseol.com/results.json` 은 `public/` 정적
 * 자산이라 **배포 시점에 구워진 사본**이고, 이 프로젝트는 `git.deploymentEnabled:false`
 * 라 `deploy.yml` 이 하루 4번만 배포한다(KST 00:10·06:10·12:10·18:10).
 *
 * 그러면 20:15 에 끝난 경기를 20:13 크롤이 커밋해도 dispatch 가 읽는 파일은 18:10
 * 배포본이라 그 경기가 아직 `scheduled` 다 — 종료 알림이 최대 6시간 늦고, 진행 중
 * 스냅샷을 봐야 하는 **득점 알림은 사실상 영영 안 맞는다.** `cache:"no-store"` 는
 * Next Data Cache 만 끄지 CDN 이 들고 있는 배포본을 바꾸지 못한다.
 *
 * raw 는 매시 크롤 커밋을 그대로 따라간다. 레포가 공개라 인증도 필요 없다.
 */
const RAW = "https://raw.githubusercontent.com/yghwanee/hanhaeseol/main/src/data";
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

  // 🔴 받는 사람이 없어도 **기록은 남긴다.** 안 그러면 같은 알림을 매 실행마다 다시
  // 만들고, 나중에 누가 그 팀을 찜하는 순간 지나간 경기의 알림이 한꺼번에 터진다.
  for (const notice of notices) {
    next.sent[notice.dedupKey] = now;
    if (notice.score) next.scores[notice.gameKey] = notice.score;
  }

  // 🔴 기록을 **보내기 전에** 저장한다. 반대 순서면 저장이 실패한 실행에서 이미 나간
  // 알림이 기록에 안 남고, 다음 실행이 같은 알림을 통째로 다시 보낸다. 못 받는 것보다
  // 같은 알림을 두 번 받는 쪽이 훨씬 나쁘다(2026-09-02 삼중 게시와 같은 판단).
  // 저장이 실패하면 아예 안 보내고 다음 실행에 맡긴다.
  //
  // 🔴 그리고 저장 직전에 **다시 읽어 병합한다.** 이 라우트를 부르는 워크플로가 둘
  // (`push-notify.yml`·`crawl-results.yml`)이라 GH 쪽 concurrency 로는 겹침을 못 막는다.
  // 통째 덮어쓰기면 나중에 저장하는 쪽이 앞 실행의 기록을 날려 그 알림들이 재발송된다.
  const fresh = await loadPushLog();
  await savePushLog(
    prunePushLog(
      {
        sent: { ...fresh.sent, ...next.sent },
        scores: { ...fresh.scores, ...next.scores },
      },
      getTodayString(),
    ),
  );

  let sentCount = 0;
  const gone = new Set<string>();

  for (const notice of notices) {
    for (const t of subs.filter((s) => shouldReceive(notice, s.follows))) {
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
 * 🔴 `cache: "no-store"` 가 필수다. 없으면 Next Data Cache 가 붙잡아 그날 첫 스냅샷에
 * 하루 종일 동결된다(2026-07-15 에 `/api/live` 가 그렇게 죽어 있었다).
 */
async function fetchJson<T>(name: string): Promise<T | null> {
  // raw 가 죽으면 배포본으로 떨어진다. 낡을지언정 아예 못 읽는 것보다 낫다.
  for (const base of [RAW, ORIGIN]) {
    try {
      const res = await fetch(`${base}/${name}`, { cache: "no-store" });
      if (res.ok) return (await res.json()) as T;
    } catch {
      /* 다음 후보로 */
    }
  }
  return null;
}

async function fetchSchedules(): Promise<Schedule[]> {
  const data = await fetchJson<ScheduleData>("schedule.json");
  return Array.isArray(data?.schedules) ? data.schedules : [];
}

async function fetchResults(): Promise<ResultsData | null> {
  return fetchJson<ResultsData>("results.json");
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

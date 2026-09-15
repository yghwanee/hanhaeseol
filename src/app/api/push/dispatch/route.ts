import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import {
  listSubscriptions,
  removeSubscription,
  removeSubscriptionById,
  subscriptionId,
  type StoredSubscription,
} from "@/lib/push/store";
import { sendPush } from "@/lib/push/send";
import { buildNotices, isStaleSubscription, shouldReceive } from "@/lib/push/notify";
import {
  loadPushLog,
  prunePushLog,
  savePushLog,
  type PushLog,
} from "@/lib/push/log-store";
import { matchToSlug } from "@/lib/match-slug";
import { getTodayString } from "@/lib/schedule-utils";
import { crawlLiveResults } from "@/lib/results/naver";
import { categoriesForLeague } from "@/lib/results/lookup";
import { isFollowedGame } from "@/lib/follows";

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

  const params = new URL(request.url).searchParams;
  const dryRun = params.get("dry") === "1";

  /**
   * 🔴 `remove=<id>` — 유령 구독 한 건을 지운다(운영용, `push-notify.yml` 의 `remove` 입력).
   * 브라우저가 구독 주소를 갈아끼우면 옛 주소 저장본이 옛 찜 목록을 든 채 남는다.
   * 사용자는 그 주소를 모르니 스스로 못 지운다. id 는 dry 응답의 `subscriberDetail` 에 있다.
   */
  const removeId = params.get("remove");
  if (removeId) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) return json({ ok: false, error: "Blob 스토어 미설정" }, 500);
    const removed = await removeSubscriptionById(removeId);
    return json({ ok: removed, removed: removed ? removeId : null });
  }

  /**
   * 🔴 `live=1` — 결과를 레포 raw 가 아니라 **네이버에서 직접** 가져온다.
   *
   * raw 는 매시 13분 크롤 커밋만 따라가므로 득점 알림이 최대 한 시간 늦는다. 실시간 골
   * 폴러(`push-live.yml`)는 스코어가 실제로 바뀐 순간에만 이 라우트를 부르는데, 그때
   * raw 를 읽으면 **아직 그 득점이 안 들어와 있어** 알림이 안 나간다. 그래서 이 모드에선
   * 같은 순간의 네이버 스냅샷을 본다.
   *
   * 🔴 raw 를 **버리지 않고 덮어쓴다.** 라이브 크롤은 진행중·종료만 담아서(payload 축소)
   * 취소·연기 상태가 빠지는데, `buildNotices` 는 그걸 보고 "곧 시작"을 막는다. 통째로
   * 갈아치우면 취소된 경기에 킥오프 알림이 나간다.
   */
  const live = params.get("live") === "1";

  // 🔴 Blob 스토어가 없으면 구독자도 발송기록도 못 읽는다. 던지게 두면 워크플로가
  // 매시 빨개져서 진짜 고장을 못 알아본다. dry-run 은 저장소 없이도 돌게 둔다 —
  // 알림 문구를 실데이터로 확인하는 용도라 구독자가 필요 없다.
  const hasStore = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
  if (!hasStore && !dryRun) {
    return json({ ok: true, skipped: "Blob 스토어 미설정" });
  }

  const [schedules, rawResults, allSubs, log] = await Promise.all([
    fetchSchedules(),
    fetchResults(),
    hasStore ? listSubscriptions().catch(() => []) : Promise.resolve([]),
    hasStore ? loadPushLog() : Promise.resolve({ sent: {}, scores: {} }),
  ]);

  /**
   * 🔴 마지막 저장이 오래된 구독은 **발송 대상에서 뺀다**(`STALE_SUB_DAYS`).
   *
   * 브라우저 쪽에서 구독을 못 집게 되면 사용자는 그 저장본을 스스로 지울 수 없다 —
   * 화면은 "꺼짐"인데 알림은 계속 온다(2026-09-15 실측: 3건이 11일째 옛 찜 보유).
   * 상한이 없으면 그 상태가 영구적이다. 살아 있는 구독은 페이지 하트비트가 갱신하므로
   * 여기 안 걸리고, 걸린 구독도 그 브라우저가 다시 오면 그 자리에서 되살아난다.
   *
   * 지우지 않고 **거르기만** 한다 — 지웠다가는 잠깐 안 들어온 사람의 알림이 영영 끊긴다.
   */
  const nowMs = Date.now();
  const subs = allSubs.filter((s) => !isStaleSubscription(s.createdAt, nowMs));
  const stale = allSubs.length - subs.length;

  /** 구독자들이 찜한 팀 키의 합집합. 폴러가 무엇을 지켜볼지 정하는 데 쓴다. */
  const watch = [...new Set(subs.flatMap((t) => t.follows))].sort();

  const results = live
    ? mergeLive(rawResults, await crawlLiveScoped(schedules, watch))
    : rawResults;

  const notices = buildNotices({
    schedules,
    results,
    now: nowMs,
    sent: new Set(Object.keys(log.sent)),
    lastScores: log.scores,
    matchUrl: (s: Schedule) => `/match/${encodeURIComponent(matchToSlug(s))}`,
  });

  // dry 에서만 구독별 [id · 마지막 저장 시각 · 찜] 을 보인다. 엔드포인트 원문은 안 싣는다
  // (워크플로 로그는 공개 레포라 누구나 본다). 마지막 저장이 오래됐는데 찜이 남아 있으면 유령이다.
  const detail = dryRun ? { subscriberDetail: describe(allSubs, nowMs), stale } : {};

  if (notices.length === 0) {
    return json({ ok: true, subscribers: subs.length, notices: 0, sent: 0, watch, ...detail });
  }
  if (dryRun) {
    return json({
      ok: true,
      dryRun: true,
      subscribers: subs.length,
      watch,
      ...detail,
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
    stale,
    watch,
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

/**
 * 찜한 팀이 걸린 경기의 리그만 골라 라이브 크롤한다.
 *
 * 전 리그(30여 개)를 훑을 이유가 없다 — 알림은 찜한 팀 경기에만 나가므로 그 리그만 보면
 * 되고, 폴러가 60초마다 부르는 경로라 요청 수가 그대로 네이버 부하가 된다.
 * 감시 목록이 비었으면(구독자 0명) 크롤 자체를 건너뛴다.
 */
async function crawlLiveScoped(
  schedules: Schedule[],
  watch: string[],
): Promise<ResultsData | null> {
  if (watch.length === 0) return null;
  const followed = new Set(watch);
  const cats = new Set<string>();
  for (const s of schedules) {
    if (!isFollowedGame(s, followed)) continue;
    for (const c of categoriesForLeague(s.league)) cats.add(c);
  }
  if (cats.size === 0) return null;
  try {
    return await crawlLiveResults([...cats]);
  } catch {
    // 네이버가 흔들리면 raw 로 판정한다. 늦을 뿐이지 틀리지는 않는다.
    return null;
  }
}

/**
 * raw 결과 위에 라이브 스냅샷을 덮는다. `byKey` 는 라이브가 이기고, raw 에만 있는 키
 * (예정·취소)는 그대로 남는다.
 */
function mergeLive(raw: ResultsData | null, live: ResultsData | null): ResultsData | null {
  if (!live) return raw;
  if (!raw) return live;
  const byKey = { ...raw.byKey, ...live.byKey };
  const liveIds = new Set(live.results.map((r) => `${r.date}|${r.categoryId}|${r.homeTeam}|${r.awayTeam}`));
  const results = [
    ...live.results,
    ...raw.results.filter((r) => !liveIds.has(`${r.date}|${r.categoryId}|${r.homeTeam}|${r.awayTeam}`)),
  ];
  return { lastUpdated: live.lastUpdated, byKey, results };
}

function describe(subs: StoredSubscription[], now: number) {
  return subs
    .map((s) => ({
      id: subscriptionId(s.subscription.endpoint),
      // 푸시 서비스 종류만(애플·구글·모질라). 기기 구분용이고 주소 원문은 아니다.
      service: safeHost(s.subscription.endpoint),
      savedAt: s.createdAt,
      // 상한을 넘겨 이미 발송에서 빠진 구독. 운영자가 지울지 판단하는 자리다.
      ...(isStaleSubscription(s.createdAt, now) ? { stale: true } : {}),
      follows: s.follows,
    }))
    .sort((a, b) => String(a.savedAt).localeCompare(String(b.savedAt)));
}

function safeHost(endpoint: string): string {
  try {
    return new URL(endpoint).host;
  } catch {
    return "?";
  }
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, { status });
}

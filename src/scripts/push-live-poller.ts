import "dotenv/config";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import { crawlLiveResults } from "@/lib/results/naver";
import { categoriesForLeague, findResult } from "@/lib/results/lookup";
import { isFollowedGame } from "@/lib/follows";

/**
 * ⭐찜한 팀 **실시간 득점 폴러**.
 *
 * 지연을 최대 1시간 → 30~60초로 줄인다.
 *
 * 🔴 왜 cron 을 자주 걸지 않고 한 프로세스로 오래 도는가:
 * 이 레포는 GH 예약 발화가 대량으로 버려지는 게 실측된 곳이다 — 하루 48회를 요구했는데
 * 실제 발화가 **2~6회**였다(2026-09-01). 그리고 **고빈도 cron 이 먼저 버려진다.** 그래서
 * **분 단위 cron 으로 바꾸면 더 나빠진다.** 발화를 하루 몇 번으로 줄이고, **한 번 켜진 잡 안에서**
 * 루프를 돌아 주기를 만든다. 유실 확률이 발화 횟수에 비례하므로 이게 유일한 방향이다.
 *
 * 🔴 왜 GH 에서 도는가 (비용):
 * 레포가 public 이라 GitHub Actions 분이 **무료·무제한**이다. 반대로 Vercel 에서 매분
 * 폴링하면 월 43,200 호출이 되고, 그게 Hobby 의 Fluid Active CPU 4시간 한도를 60% 먹는다
 * (2026-08-17 에 계정이 잠긴 원인이 정확히 이 종류의 반복 실행이었다).
 * 그래서 **폴링은 여기서(무료), 발송만 Vercel 에서** 한다 — 스코어가 실제로 바뀐 순간에만
 * `/api/push/dispatch?live=1` 을 부르므로 Vercel 호출은 하루 몇 건이다.
 *
 * 🔴 중복 방지는 여기서 하지 않는다. 이 스크립트의 `lastTotals` 는 "언제 부를지" 만
 * 정하고, 같은 알림을 두 번 보내지 않는 책임은 dispatch 의 `dedupKey`·`lastScores`
 * (Blob 기록)에 있다. 프로세스가 죽어 메모리가 날아가도 재발송이 안 되는 이유다.
 */

const ORIGIN = process.env.PUSH_ORIGIN ?? "https://haeseol.com";
const RAW = "https://raw.githubusercontent.com/yghwanee/hanhaeseol/main/src/data";

/** 폴링 간격. 30초보다 짧게 두지 말 것 — 네이버 부하만 늘고 반영은 그만큼 안 빨라진다. */
const POLL_MS = Number(process.env.POLL_MS ?? 60_000);
/** 이 프로세스의 수명. GH 잡 상한이 6시간이라 그 안에서 끝나야 한다. */
const MAX_MINUTES = Number(process.env.MAX_MINUTES ?? 300);
/** 지켜볼 경기가 하나도 없는 상태가 이만큼 이어지면 조용히 끝낸다. */
const IDLE_EXIT_POLLS = 5;

const KEY = process.env.PUSH_TEST_KEY ?? "";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 알림 대상이 될 수 있는 시간대의 경기만 남긴다(어제~내일). */
function nearbyDates(): Set<string> {
  const out = new Set<string>();
  for (const d of [-1, 0, 1]) {
    const t = new Date(Date.now() + d * 86_400_000);
    out.add(t.toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" }));
  }
  return out;
}

async function fetchSchedules(): Promise<Schedule[]> {
  for (const base of [RAW, ORIGIN]) {
    try {
      const res = await fetch(`${base}/schedule.json`, { cache: "no-store" });
      if (res.ok) {
        const d = (await res.json()) as ScheduleData;
        return Array.isArray(d.schedules) ? d.schedules : [];
      }
    } catch {
      /* 다음 후보 */
    }
  }
  return [];
}

/** dispatch 호출. `watch`(구독자들이 찜한 팀 키 합집합)를 돌려준다. */
async function callDispatch(live: boolean): Promise<{ watch: string[]; sent: number } | null> {
  try {
    const res = await fetch(`${ORIGIN}/api/push/dispatch${live ? "?live=1" : ""}`, {
      method: "POST",
      headers: { "x-push-key": KEY },
    });
    if (!res.ok) {
      log(`[dispatch] HTTP ${res.status}`);
      return null;
    }
    const j = (await res.json()) as { watch?: string[]; sent?: number; notices?: number };
    return { watch: j.watch ?? [], sent: j.sent ?? 0 };
  } catch (e) {
    log(`[dispatch] 실패: ${(e as Error).message}`);
    return null;
  }
}

/** 스코어 합계. 없으면 null(아직 진행 전이거나 스코어가 안 붙은 상태). */
function totalOf(r: { homeScore?: number; awayScore?: number } | undefined): number | null {
  if (!r || typeof r.homeScore !== "number" || typeof r.awayScore !== "number") return null;
  return r.homeScore + r.awayScore;
}

async function main() {
  if (!KEY) {
    log("PUSH_TEST_KEY 가 없다. 아무것도 하지 않고 끝낸다(셋업 전 워크플로가 빨개지지 않게).");
    return;
  }

  // 첫 호출은 감시 목록을 받는 것이 목적이다. 겸사겸사 시각 기반 알림(예고·시작)도 걸린다.
  const first = await callDispatch(false);
  const watch = new Set(first?.watch ?? []);
  log(`감시 대상 팀 ${watch.size}개`);
  if (watch.size === 0) {
    log("찜한 팀이 있는 구독자가 없다. 폴링할 이유가 없어 끝낸다.");
    return;
  }

  const schedules = await fetchSchedules();
  const dates = nearbyDates();
  const targets = schedules.filter((s) => dates.has(s.date) && isFollowedGame(s, watch));
  const cats = [...new Set(targets.flatMap((s) => categoriesForLeague(s.league)))];
  log(`대상 경기 ${targets.length}건 · 크롤 리그 ${cats.length}개 [${cats.join(", ")}]`);
  if (targets.length === 0 || cats.length === 0) {
    log("어제~내일 사이에 찜한 팀 경기가 없다. 끝낸다.");
    return;
  }

  const deadline = Date.now() + MAX_MINUTES * 60_000;
  /** gameKey → 마지막으로 본 스코어 합계. dispatch 를 부를지 정하는 기준선. */
  const lastTotals = new Map<string, number>();
  /** 종료를 이미 알린 경기. 같은 종료로 계속 부르지 않게 한다. */
  const finishedSeen = new Set<string>();
  let idle = 0;
  let polls = 0;

  while (Date.now() < deadline) {
    polls += 1;
    let live: ResultsData;
    try {
      live = await crawlLiveResults(cats);
    } catch (e) {
      log(`[크롤] 실패, 다음 주기에 재시도: ${(e as Error).message}`);
      await sleep(POLL_MS);
      continue;
    }

    const reasons: string[] = [];
    let watching = 0;

    for (const s of targets) {
      const r = findResult(live, s);
      if (!r) continue;
      const gk = `${s.date}|${s.homeTeam}|${s.awayTeam}`;

      if (r.status === "live") watching += 1;

      const total = totalOf(r);
      if (r.status === "live" && total !== null && total > 0) {
        const prev = lastTotals.get(gk);
        if (prev === undefined || total > prev) {
          lastTotals.set(gk, total);
          // 🔴 기준선이 없던 첫 관측은 부르지 않는다. 폴러가 경기 중간에 켜졌을 때
          //    이미 난 점수를 "방금 난 것"으로 알리게 된다. dispatch 의 lastScores 가
          //    최종 판단을 하지만, 불필요한 호출을 여기서 먼저 막는다.
          if (prev !== undefined) reasons.push(`${gk} 득점 ${prev}→${total}`);
        }
      }

      if (r.status === "finished" && !finishedSeen.has(gk)) {
        finishedSeen.add(gk);
        reasons.push(`${gk} 종료`);
      }
    }

    if (reasons.length > 0) {
      log(`변화 감지: ${reasons.join(" / ")} → dispatch(live)`);
      const out = await callDispatch(true);
      log(`  발송 ${out?.sent ?? "?"}건`);
      idle = 0;
    } else {
      idle = watching > 0 ? 0 : idle + 1;
      if (polls % 10 === 0) log(`폴링 ${polls}회 · 진행중 ${watching}건 · 변화 없음`);
    }

    // 진행 중인 경기가 한동안 없으면 창이 끝난 것이다. 남은 시간을 태우지 않는다.
    if (idle >= IDLE_EXIT_POLLS) {
      log(`진행 중 경기가 ${IDLE_EXIT_POLLS}주기 연속 없다. 끝낸다.`);
      return;
    }

    await sleep(POLL_MS);
  }
  log(`수명(${MAX_MINUTES}분) 도달. 끝낸다.`);
}

main().catch((err) => {
  console.error("[push-live] fatal:", err);
  process.exit(1);
});

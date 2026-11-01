import "dotenv/config";
import fs from "node:fs";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import { crawlLiveResults } from "@/lib/results/naver";
import { findResult } from "@/lib/results/lookup";
import { activeCategories, hasHotGame } from "@/lib/results/active-categories";
import { isFollowedGame } from "@/lib/follows";

/**
 * 라이브 중계기. 네이버 스코어를 받아 Vercel 로 올리고, 찜한 팀 스코어가 바뀌면 알림을 깨운다.
 *
 * 🔴 왜 GH 에서 도는가: 2026-10-26 부터 네이버 스포츠 API 가 Vercel 요청에 응답하지 않는다.
 * GH 에서는 tools/naver-browser-preload.mjs 의 Chromium 으로 받는다. Actions 분은 무료다.
 * 🔴 주기는 cron 이 아니라 이 루프가 만든다. 고빈도 cron 은 GH 가 먼저 버린다(2026-09-01 실측).
 * 경기 시간대에만 네이버에 요청하고, 경기가 없으면 끝낸다. 수명이 끝나면 워크플로가 다음 실행을 잇는다.
 */
const ORIGIN = process.env.PUSH_ORIGIN ?? "https://haeseol.com";
const RAW = "https://raw.githubusercontent.com/yghwanee/hanhaeseol/main/src/data/schedule.json";
const POLL_MS = Number(process.env.POLL_MS ?? 60_000);
const MAX_MINUTES = Number(process.env.MAX_MINUTES ?? 300);
/** 움직일 경기가 없는 상태가 이만큼 이어지면 끝낸다. */
const IDLE_EXIT_POLLS = 10;
/** 스코어가 그대로여도 이 간격으로 다시 올린다. 보관소 TTL(30분)보다 짧아야 한다. */
const HEARTBEAT_MS = 10 * 60_000;
const KEY = process.env.PUSH_TEST_KEY ?? "";

const log = (...a: unknown[]) => console.log(new Date().toISOString(), ...a);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function fetchSchedules(): Promise<Schedule[]> {
  const res = await fetch(RAW, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) throw new Error(`schedule HTTP ${res.status}`);
  return ((await res.json()) as ScheduleData).schedules ?? [];
}

async function post(path: string, body?: unknown): Promise<Response> {
  return fetch(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "x-push-key": KEY, "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(60_000),
  });
}

/** lastUpdated 를 뺀 내용 비교용. */
const fingerprint = (d: ResultsData) => JSON.stringify(d.results);

async function main() {
  if (!KEY) {
    log("PUSH_TEST_KEY 가 없어 끝낸다.");
    process.exit(1);
  }
  const deadline = Date.now() + MAX_MINUTES * 60_000;
  let schedules: Schedule[] = [];
  let watch = new Set<string>();
  let scheduleAt = 0;
  let lastPrint = "";
  let lastUpload = 0;
  const lastState = new Map<string, string>();
  let idle = 0;

  while (Date.now() < deadline) {
    try {
      if (Date.now() - scheduleAt > 30 * 60_000) {
        schedules = await fetchSchedules();
        const res = await post("/api/push/dispatch");
        if (res.ok) watch = new Set(((await res.json()) as { watch?: string[] }).watch ?? []);
        scheduleAt = Date.now();
        log(`편성 ${schedules.length}건 · 찜 ${watch.size}팀`);
      }

      const cats = activeCategories(schedules, Date.now());
      if (!hasHotGame(schedules, Date.now())) {
        idle += 1;
        if (idle >= IDLE_EXIT_POLLS) {
          log(`움직일 경기가 ${IDLE_EXIT_POLLS}주기 연속 없다. 끝낸다.`);
          return;
        }
      } else if (cats.length > 0) {
        idle = 0;
        const live = await crawlLiveResults(cats);
        const print = fingerprint(live);
        // 전부 실패해 0건이면 올리지 않는다. 직전 스코어가 보관소에 남는 쪽이 낫다.
        if (live.results.length > 0 && (print !== lastPrint || Date.now() - lastUpload > HEARTBEAT_MS)) {
          const res = await post("/api/live/ingest", live);
          if (!res.ok) throw new Error(`ingest HTTP ${res.status}`);
          lastPrint = print;
          lastUpload = Date.now();
          log(`업로드 ${live.results.length}건 · 리그 ${cats.length}개`);

          let changed = false;
          for (const s of schedules) {
            if (!isFollowedGame(s, watch)) continue;
            const r = findResult(live, s);
            if (!r) continue;
            const gk = `${s.date}|${s.homeTeam}|${s.awayTeam}`;
            const state = `${r.status}|${r.homeScore}|${r.awayScore}`;
            const prev = lastState.get(gk);
            lastState.set(gk, state);
            // 첫 관측은 기준선이다. 중간에 켜졌을 때 이미 난 점수를 방금 난 것으로 알리지 않는다.
            if (prev !== undefined && prev !== state) changed = true;
          }
          if (changed) {
            const res2 = await post("/api/push/dispatch?live=1");
            log(`알림 요청 HTTP ${res2.status}`);
          }
        }
      }
    } catch (e) {
      log(`실패, 다음 주기에 재시도: ${(e as Error).message}`);
    }
    await sleep(POLL_MS);
  }
  log(`수명(${MAX_MINUTES}분) 도달. 끝낸다.`);
  // 워크플로가 이 값을 보고 다음 실행을 잇는다.
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, "chain=true\n");
}

main().catch((err) => {
  console.error("[live-relay] fatal:", err);
  process.exit(1);
});

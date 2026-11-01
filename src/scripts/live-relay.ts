import "dotenv/config";
import fs from "node:fs";
import type { Schedule, ScheduleData } from "@/types/schedule";
import type { ResultsData } from "@/types/results";
import { crawlLiveResults, SOCCER_CATEGORIES } from "@/lib/results/naver";
import { naverFetch } from "@/lib/naver-fetch";
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
/** 스코어·상태가 그대로면 이 간격으로만 올린다. 경기 시간 표시(전반 40')가 이만큼 늦을 수 있다. Vercel 호출을 줄이려는 값이다. */
const HEARTBEAT_MS = 3 * 60_000;
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

/** 라인업을 다시 확인하는 간격. 킥오프 1시간 전쯤 뜨고 그 뒤로 거의 안 바뀐다. */
const LINEUP_EVERY_MS = 10 * 60_000;
/** 몇 일 전 경기까지 라인업을 채울지. 지난 경기를 메울 때만 늘린다(매치 페이지 수명 14일). */
const LINEUP_DAYS = Number(process.env.LINEUP_DAYS || 2);
const NAVER_HEADERS = {
  Referer: "https://m.sports.naver.com/",
  "User-Agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1",
};

type LineupKind = "lineup" | "preview";
type GameRef = { date: string; categoryId: string; gameId?: string; status?: string };

function lineupKind(categoryId: string): LineupKind | null {
  if (categoryId === "kbo" || categoryId === "mlb") return "preview";
  return SOCCER_CATEGORIES.has(categoryId) ? "lineup" : null;
}

function hasLineup(kind: LineupKind, text: string): boolean {
  const r = (JSON.parse(text) as { result?: Record<string, Record<string, unknown> | undefined> }).result;
  return kind === "lineup" ? !!r?.lineUpData?.lineup : !!r?.previewData?.homeTeamLineUp;
}

/** 끝난 경기는 한 번만 받고, 그 전 경기는 바뀌었을 때만 올린다. */
const lineupSeen = new Map<string, string>();
const lineupDone = new Set<string>();

async function syncLineups(): Promise<void> {
  const base = RAW.replace("schedule.json", "");
  const [recent, archive] = await Promise.all(
    ["results.json", "results-archive.json"].map(async (f) => {
      const res = await fetch(base + f, { signal: AbortSignal.timeout(60_000) });
      return ((await res.json()) as { results?: GameRef[] }).results ?? [];
    }),
  );
  const from = new Date(Date.now() - LINEUP_DAYS * 86_400_000).toLocaleDateString("en-CA", { timeZone: "Asia/Seoul" });
  const to = new Date(Date.now() + 9 * 3_600_000).toISOString().slice(0, 10);
  const games = new Map<string, GameRef>();
  for (const g of [...archive, ...recent]) {
    if (g.gameId && g.date >= from && g.date <= to && lineupKind(g.categoryId)) games.set(g.gameId, g);
  }
  const todo = [...games.values()].filter((g) => !lineupDone.has(g.gameId!));
  let uploaded = 0;
  for (let i = 0; i < todo.length; i += 8) {
    const batch = await Promise.all(
      todo.slice(i, i + 8).map(async (g) => {
        const kind = lineupKind(g.categoryId)!;
        try {
          const res = await naverFetch(`https://api-gw.sports.naver.com/schedule/games/${g.gameId}/${kind}`, { headers: NAVER_HEADERS });
          if (!res.ok) return null;
          const json = await res.text();
          if (g.status === "finished") lineupDone.add(g.gameId!);
          if (!hasLineup(kind, json) || lineupSeen.get(g.gameId!) === json) return null;
          lineupSeen.set(g.gameId!, json);
          return { kind, gameId: g.gameId!, json };
        } catch {
          return null;
        }
      }),
    );
    const lineups = batch.filter((b) => b !== null);
    if (lineups.length > 0) {
      const res = await post("/api/live/ingest", { lineups });
      if (res.ok) uploaded += lineups.length;
      else log(`라인업 업로드 HTTP ${res.status}`);
    }
  }
  log(`라인업 확인 ${todo.length}경기 · 업로드 ${uploaded}건`);
}

/** 스코어·상태만 비교한다. 경기 시간(period)은 매분 바뀌어 넣으면 매분 올리게 된다. */
const fingerprint = (d: ResultsData) =>
  JSON.stringify(d.results.map((r) => [r.date, r.categoryId, r.homeTeam, r.awayTeam, r.status, r.homeScore, r.awayScore]));

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
  let lineupAt = 0;

  while (Date.now() < deadline) {
    try {
      if (Date.now() - scheduleAt > 30 * 60_000) {
        schedules = await fetchSchedules();
        const res = await post("/api/push/dispatch");
        if (res.ok) watch = new Set(((await res.json()) as { watch?: string[] }).watch ?? []);
        scheduleAt = Date.now();
        log(`편성 ${schedules.length}건 · 찜 ${watch.size}팀`);
      }

      if (Date.now() - lineupAt > LINEUP_EVERY_MS && (lineupAt === 0 || hasHotGame(schedules, Date.now()))) {
        lineupAt = Date.now();
        await syncLineups();
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

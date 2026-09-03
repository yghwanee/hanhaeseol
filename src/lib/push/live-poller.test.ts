import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 실시간 득점 폴러 가드.
 *
 * 여기서 막는 건 **비용 사고와 발화 유실**이다. 둘 다 이 레포에서 실제로 한 번씩 터졌다:
 *  - 2026-08-17 Vercel Hobby 한도 초과로 계정 잠김(반복 실행이 CPU 를 먹었다)
 *  - 2026-09-01 GH 예약 발화 유실(하루 48회 요구에 2~6회 발화, 고빈도 cron 이 먼저 버려짐)
 *
 * 그래서 "분 단위 cron 금지"와 "폴링은 GH 에서" 두 가지를 코드가 아니라 **파일 내용으로**
 * 고정한다. 나중에 누가 "더 실시간으로" 만들려고 cron 을 조이는 순간 여기서 막힌다.
 */

const ROOT = process.cwd();
const WF = path.join(ROOT, ".github/workflows/push-live.yml");
const POLLER = path.join(ROOT, "src/scripts/push-live-poller.ts");
const read = (p: string) => fs.readFileSync(p, "utf-8");

test("워크플로와 폴러 스크립트가 존재한다", () => {
  assert.ok(fs.existsSync(WF), "push-live.yml 이 없다");
  assert.ok(fs.existsSync(POLLER), "push-live-poller.ts 가 없다");
});

test("🔴 분 단위 cron 금지 — 고빈도 cron 은 GH 가 먼저 버린다", () => {
  const crons = [...read(WF).matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.ok(crons.length > 0, "cron 이 하나도 없다");
  for (const c of crons) {
    const minute = c.trim().split(/\s+/)[0];
    assert.ok(
      /^\d+$/.test(minute),
      `cron "${c}" 의 분 필드가 "${minute}" 다. 고정 분(예: '5')만 허용한다 —\n` +
        `  '*/n' 이나 목록은 하루 발화 요구를 늘려 GH 가 먼저 버린다(2026-09-01 실측).\n` +
        `  주기는 cron 이 아니라 잡 안의 루프(POLL_MS)로 만든다.`,
    );
  }
  assert.ok(
    crons.length <= 6,
    `cron 이 ${crons.length}개다. 하루 발화를 6회 이하로 유지할 것 — 발화 유실 확률이 횟수에 비례한다.`,
  );
});

test("🔴 겹침 방지(concurrency)가 있고, 돌고 있는 창을 죽이지 않는다", () => {
  const wf = read(WF);
  assert.match(wf, /concurrency:/, "concurrency 블록이 없다 — 두 프로세스가 같은 득점을 중복 감지한다");
  assert.match(
    wf,
    /cancel-in-progress:\s*false/,
    "cancel-in-progress 가 false 가 아니다 — 새 발화가 돌고 있는 창을 죽이면 그 시간대 알림이 빈다",
  );
});

test("🔴 폴링 간격은 30초 미만으로 못 내린다", () => {
  const m = read(WF).match(/POLL_MS:\s*'(\d+)'/);
  assert.ok(m, "워크플로에 POLL_MS 가 없다");
  assert.ok(
    Number(m![1]) >= 30_000,
    `POLL_MS 가 ${m![1]}ms 다. 30000 미만은 네이버 부하만 늘고 반영은 그만큼 안 빨라진다.`,
  );
});

test("🔴 잡 상한이 스크립트 수명보다 크다 — 중간에 잘리면 정리 로그도 안 남는다", () => {
  const wf = read(WF);
  const job = Number(wf.match(/timeout-minutes:\s*(\d+)/)![1]);
  const life = Number(wf.match(/minutes\s*\|\|\s*'(\d+)'/)![1]);
  assert.ok(job > life, `잡 상한 ${job}분 ≤ 스크립트 수명 ${life}분`);
  assert.ok(job <= 360, `잡 상한 ${job}분. GitHub 호스티드 러너의 잡 상한은 6시간(360분)이다.`);
});

test("🔴 폴링은 GH 에서 돈다 — Vercel 을 주기적으로 때리면 안 된다", () => {
  const src = read(POLLER);
  // 네이버 크롤은 이 스크립트 안에서 한다(= GH 에서, 무료).
  assert.match(src, /crawlLiveResults\(/, "폴러가 네이버를 직접 크롤하지 않는다");
  // dispatch 는 변화가 있을 때만 부른다 — 루프 안에서 무조건 부르면 Vercel 호출이 폭증한다.
  const loop = src.slice(src.indexOf("while (Date.now() < deadline)"));
  assert.match(
    loop,
    /if \(reasons\.length > 0\)[\s\S]{0,200}callDispatch\(true\)/,
    "루프가 변화 여부와 무관하게 dispatch 를 부른다 — Hobby Fluid Active CPU(4h) 를 태운다",
  );
});

test("🔴 리그를 좁혀 크롤한다 — 전 리그를 60초마다 훑으면 네이버가 막는다", () => {
  const src = read(POLLER);
  assert.match(src, /categoriesForLeague/, "대상 리그를 계산하지 않는다");
  assert.match(src, /crawlLiveResults\(cats\)/, "crawlLiveResults 에 리그 목록을 넘기지 않는다");
});

test("찜한 팀이 없으면 폴링하지 않고 끝낸다", () => {
  const src = read(POLLER);
  assert.match(src, /watch\.size === 0/, "감시 목록이 빈 경우를 안 걸러낸다");
  assert.match(src, /IDLE_EXIT_POLLS/, "진행 중 경기가 없을 때 조기 종료하지 않는다");
});

test("🔴 첫 관측만으로는 알리지 않는다 — 경기 중간에 켜지면 지난 점수를 방금 난 것으로 알린다", () => {
  assert.match(
    read(POLLER),
    /if \(prev !== undefined\) reasons\.push/,
    "기준선(prev)이 없는 첫 관측에서도 알림을 트리거한다",
  );
});

test("🔴 dispatch 의 live 모드는 raw 를 버리지 않고 덮는다", () => {
  const route = read(path.join(ROOT, "src/app/api/push/dispatch/route.ts"));
  assert.match(route, /live === "1"|params\.get\("live"\)/, "live 모드가 없다");
  assert.match(route, /function mergeLive/, "mergeLive 가 없다");
  // 라이브 크롤은 진행중·종료만 담아서, 통째로 갈아치우면 취소된 경기에 킥오프 알림이 나간다.
  assert.match(
    route,
    /\{ \.\.\.raw\.byKey, \.\.\.live\.byKey \}/,
    "byKey 를 병합하지 않는다 — 취소·연기 상태가 사라져 취소 경기에 알림이 나간다",
  );
});

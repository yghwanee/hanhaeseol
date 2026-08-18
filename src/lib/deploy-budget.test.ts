/**
 * 배포 횟수와 ISR 재생성 주기를 잠그는 가드.
 *
 * 배경(2026-08-18, 작업92): Vercel Hobby 무료 한도를 초과해 계정이 잠기면서
 * haeseol.com·chaeun·fadeby 세 사이트가 8시간 전부 다운됐다. 초과를 만든 건 둘이다.
 *
 *  1) 홈 `revalidate = 60` — 한 달 43,200회 재생성. 데이터가 빌드 번들 안에 있어
 *     재생성해도 **같은 HTML** 이 나오는데도 돌았다(= 순수 낭비). Fast Origin
 *     Transfer 12.63GB ÷ 홈 HTML 305KB ≈ 43,400 으로 수치가 맞아떨어졌다.
 *  2) 프로덕션 배포 하루 30~46회 — 배포마다 440페이지 프리렌더 + ISR 캐시 전체
 *     무효화 → 크롤러가 훑는 매치 페이지 1,600여 장이 다시 렌더된다.
 *
 * 🔴 처음엔 크롤 커밋에 `[vercel skip]` 을 붙여 (2)를 막으려 했는데 **그 토큰은
 *    실제로 안 먹는다.** main 의 skip 커밋 `ea34f729` 의 GitHub deployment status 가
 *    `state=success / Deployment has completed` 였다 = 풀빌드가 그대로 돌았다.
 *    그래서 `vercel.json` 의 `git.deploymentEnabled: false` 로 git push 배포를 통째로
 *    끄고, 배포는 **Deploy Hook 을 부르는 곳에서만** 일어나게 했다.
 *
 * 이 파일은 그 두 장치가 조용히 풀리는 걸 막는다. 값을 되돌리려면 이 테스트를
 * 같이 고쳐야 하고, 그때 위 사고 기록을 읽게 된다.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const WF_DIR = ".github/workflows";
const read = (p: string) => readFileSync(p, "utf8");

/** 훅을 부르도록 **의도된** 곳. 여기 없는 워크플로가 훅을 부르면 배포 예산이 샌다. */
const HOOK_CALLERS = [
  "deploy.yml", // 예약 배포(하루 4회)
  "crawl.yml", // 편성 갱신 시 즉시
  "auto-publish-draft.yml", // 가이드 발행 시 즉시
];

/** 하루 예약 배포 횟수. 늘리면 ISR Writes·Origin Transfer 가 비례해서 늘어난다. */
const SCHEDULED_DEPLOYS_PER_DAY = 4;

test("git push 로는 배포되지 않는다 (vercel.json)", () => {
  const cfg = JSON.parse(read("vercel.json"));
  assert.equal(
    cfg?.git?.deploymentEnabled,
    false,
    "vercel.json 의 git.deploymentEnabled 가 false 여야 한다.\n" +
      "true 로 돌리거나 지우면 push 마다 프로덕션 빌드가 돌아 하루 30~46회가 된다.\n" +
      "🔴 커밋 메시지 [vercel skip] 로는 못 막는다 — 실측으로 확인됨(ea34f729).",
  );
});

test("Deploy Hook 을 부르는 곳은 정해진 셋뿐이다", () => {
  const callers = readdirSync(WF_DIR)
    .filter((f) => f.endsWith(".yml"))
    .filter((f) => /VERCEL_DEPLOY_HOOK_URL"?\s*$|-X POST "\$VERCEL_DEPLOY_HOOK_URL"/m.test(read(join(WF_DIR, f))))
    .sort();
  assert.deepEqual(
    callers,
    [...HOOK_CALLERS].sort(),
    "배포를 거는 워크플로가 바뀌었다. 배포 횟수 = 훅을 부르는 횟수이므로,\n" +
      "새로 추가하려면 하루 총 몇 회가 되는지 계산하고 이 목록을 함께 고칠 것.",
  );
});

test("예약 배포는 하루 4회다", () => {
  const y = read(join(WF_DIR, "deploy.yml"));
  const crons = [...y.matchAll(/^\s*-\s*cron:\s*'([^']+)'/gm)].map((m) => m[1]);
  assert.equal(
    crons.length,
    SCHEDULED_DEPLOYS_PER_DAY,
    `deploy.yml 의 cron 이 ${crons.length}개다(기대 ${SCHEDULED_DEPLOYS_PER_DAY}).\n` +
      "늘리면 ISR Writes·Fast Origin Transfer 가 비례해 늘어 Hobby 한도에 다시 닿는다.",
  );
  // 매시/매분 도는 표현이 섞이면 4개처럼 보여도 실제로는 수십 번 돈다.
  for (const c of crons) {
    assert.ok(
      !c.includes("*/") && !/^\S+\s+\*/.test(c),
      `cron '${c}' 이 하루 여러 번 돈다. 예약 배포는 고정 시각만 쓴다.`,
    );
  }
});

test("편성 크롤과 가이드 발행은 훅을 직접 부른다 (6시간 지연 금지)", () => {
  for (const f of ["crawl.yml", "auto-publish-draft.yml"]) {
    const y = read(join(WF_DIR, f));
    assert.ok(
      y.includes('-X POST "$VERCEL_DEPLOY_HOOK_URL"'),
      `${f} 이 Deploy Hook 을 부르지 않는다.\n` +
        "git push 로는 배포가 안 되므로, 훅을 안 부르면 편성/새 글이 다음 예약 배포까지\n" +
        "최대 6시간 사이트에 안 뜬다.",
    );
    assert.ok(
      y.includes("VERCEL_DEPLOY_HOOK_URL: ${{ secrets.VERCEL_DEPLOY_HOOK_URL }}"),
      `${f} 의 env 에 VERCEL_DEPLOY_HOOK_URL 이 없다(시크릿이 안 들어가면 조용히 건너뛴다).`,
    );
  }
});

test("페이지 revalidate 는 3600 이상이다", () => {
  // 데이터가 빌드 번들 안에 있어 재생성해도 같은 HTML 이 나온다. 짧게 두면
  // 그만큼 ISR Writes·Fluid Active CPU·Origin Transfer 를 그대로 태운다.
  const pages = [
    "src/app/page.tsx",
    "src/app/commentary/page.tsx",
    "src/app/league/[slug]/page.tsx",
    "src/app/platform/[slug]/page.tsx",
    "src/app/team/[slug]/page.tsx",
  ];
  for (const p of pages) {
    const m = read(p).match(/^export const revalidate = (\d+);/m);
    assert.ok(m, `${p} 에 revalidate 선언이 없다.`);
    const v = Number(m![1]);
    assert.ok(
      v >= 3600,
      `${p} 의 revalidate 가 ${v}다. 3600 미만으로 내리면 한 달 재생성 횟수가\n` +
        `${Math.round((30 * 86400) / v).toLocaleString()}회가 된다(홈 기준 60일 때 43,200회로 계정이 잠겼다).`,
    );
  }
});

test("/api/live 엣지 캐시는 클라 폴링 간격보다 길다", () => {
  const route = read("src/app/api/live/route.ts");
  const sMaxAge = Number(route.match(/s-maxage=(\d+), stale-while-revalidate/)![1]);
  // 폴링 간격은 홈과 매치 페이지 두 곳에 있다. 둘 중 짧은 쪽을 기준으로 삼는다.
  const intervals = ["src/app/ScheduleClient.tsx", "src/app/match/[slug]/_components/MatchLiveScore.tsx"]
    .map((p) => Number(read(p).match(/setTimeout\(tick, (\d+)\)/)![1]) / 1000);
  const shortest = Math.min(...intervals);
  assert.ok(
    sMaxAge >= shortest,
    `s-maxage=${sMaxAge}s 가 폴링 간격 ${shortest}s 보다 짧다.\n` +
      "TTL 이 폴링보다 짧으면 다음 요청 때 이미 만료돼 있어, 한 명이 봐도 사실상\n" +
      "매번 원본 함수를 때린다(= 캐시가 일을 안 한다).",
  );
});

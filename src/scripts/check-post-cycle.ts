/**
 * 이 실행이 **지금 게시해도 되는지** 판정해 `skip` / `reason` 을 출력한다.
 *
 * 🔴 지켜야 할 세트 (운영자 정의): 아침 = 오늘 경기 / 저녁 = 내일 경기.
 *    저녁(D)과 다음날 아침(D+1)은 **대상 날짜가 같은 게 정상**이다.
 *    자세한 배경과 2026-08-30 사고는 src/lib/post-duplicate.ts 머리말 참조.
 *
 * 막는 것 셋 (전부 **실제로 게시한 실행만** 센다):
 *   ① 사이클 창 밖 예약 발화 — 저녁이 자정 넘겨 돌면, 아침이 저녁까지 밀리면 중단.
 *   ② 같은 슬롯이 같은 날짜를 이미 올림 — 진짜 중복 재실행.
 *   ③ 상대 슬롯이 같은 날짜를 MIN_GAP_HOURS 안에 올림 — 너무 붙어서 나가는 것.
 *
 * 🔴 수동 실행(workflow_dispatch)은 전부 통과시킨다. 그게 복구 수단이다.
 * 🔴 fail-open. 조회가 실패하면 게시를 막지 않는다. 감시가 잘못 돌아
 *    하루치 게시가 통째로 사라지는 쪽이, 중복 한 번보다 나쁘다.
 */
import fs from "fs";
import { getKstToday, kstNow } from "../lib/instagram";
import { getPostSlot } from "../lib/post-slot";
import {
  findSameSlotDuplicate,
  findTooCloseRun,
  isInCycleWindow,
  runDidPost,
  LOOKBACK_HOURS,
  MIN_GAP_HOURS,
  MORNING_LATEST_HOUR,
  type OtherRun,
} from "../lib/post-duplicate";

const MY_WF = process.env.HHS_WORKFLOW ?? "";
const OTHER_WF = MY_WF === "instagram.yml" ? "instagram-morning.yml" : "instagram.yml";
/** 워크플로별 KST_OFFSET_DAYS. 아침=0, 저녁=1. */
const offsetOf = (wf: string) => (wf === "instagram.yml" ? 1 : 0);

const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
/** 지금 실행 자신은 세면 안 된다. */
const MY_RUN_ID = process.env.GITHUB_RUN_ID ?? "";

function out(key: string, value: string) {
  const f = process.env.GITHUB_OUTPUT;
  if (f) fs.appendFileSync(f, `${key}=${value}\n`);
}

function skip(reason: string) {
  console.log(`⏭️  게시 중단 — ${reason}`);
  out("skip", "true");
  out("reason", reason);
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) fs.appendFileSync(summary, `⏭️ 게시 중단 — ${reason}\n\n`);
}

async function gh<T>(path: string): Promise<T> {
  // fetch-cache-ok: GH Actions 전용 스크립트라 Next 런타임 캐시와 무관하다.
  const res = await fetch(`https://api.github.com${path}`, {
    headers: { authorization: `Bearer ${TOKEN}`, accept: "application/vnd.github+json" },
  });
  if (!res.ok) throw new Error(`${path} → ${res.status} ${res.statusText}`);
  return (await res.json()) as T;
}

interface RawRun extends OtherRun {
  id: number;
}

/**
 * 워크플로의 최근 완료 실행을 가져오고, 각각이 **실제로 게시했는지** 스텝으로 판정한다.
 *
 * 🔴 conclusion=success 만으로는 안 된다. 사이클 검사에 걸려 스킵된 실행도
 * success 로 끝난다(2026-08-30 아침이 그랬다). 그걸 "이미 올렸다"고 세면
 * 스킵이 다음 스킵을 부른다.
 */
async function fetchRuns(wf: string): Promise<OtherRun[]> {
  const data = await gh<{ workflow_runs?: RawRun[] }>(
    `/repos/${REPO}/actions/workflows/${wf}/runs?per_page=10&status=completed`,
  );
  const runs = (data.workflow_runs ?? []).filter((r) => String(r.id) !== MY_RUN_ID);
  const recent = runs.filter((r) => {
    const t = new Date(r.run_started_at).getTime();
    return Number.isFinite(t) && t >= Date.now() - LOOKBACK_HOURS * 3600_000;
  });
  return Promise.all(
    recent.map(async (r) => {
      if (r.conclusion !== "success") return r;
      try {
        const jobs = await gh<{ jobs?: { steps?: { name?: string; conclusion?: string }[] }[] }>(
          `/repos/${REPO}/actions/runs/${r.id}/jobs?per_page=20`,
        );
        const steps = (jobs.jobs ?? []).flatMap((j) => j.steps ?? []);
        // 스텝을 못 읽었으면 판정하지 않는다(=게시한 것으로 본다).
        return steps.length === 0 ? r : { ...r, posted: runDidPost(steps) };
      } catch {
        return r;
      }
    }),
  );
}

async function main() {
  const now = new Date();
  const k = kstNow(now);
  const { today: myTarget } = getKstToday(undefined, now);
  const slot = getPostSlot(myTarget);
  out("target", myTarget);
  console.log(`🗓️  대상 ${myTarget} · slot=${slot} · KST ${k.getHours()}시 (${MY_WF || "unset"})`);

  // 🔴 수동 실행(workflow_dispatch)은 **모든 검사** 통과. 사고 복구 경로다.
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    console.log("🖐️  수동 실행 — 사이클 창·중복 검사를 건너뛴다(복구 경로).");
    out("skip", "false");
    return;
  }

  // ① 사이클 창.
  if (!isInCycleWindow(slot, now)) {
    const window = slot === "morning" ? `KST 00~${MORNING_LATEST_HOUR}시` : "KST 12~24시";
    skip(
      `${slot === "morning" ? "아침(오늘치)" : "저녁(내일치)"} 사이클이 창(${window}) 밖 ` +
        `KST ${k.getHours()}시에 발화했다. cron 지연으로 남의 시간대로 넘어간 게시물이라 올리지 않는다.`,
    );
    return;
  }

  if (!REPO || !TOKEN) {
    console.log("ℹ️  레포/토큰이 없어 중복 검사를 건너뛴다(로컬 실행).");
    out("skip", "false");
    return;
  }

  let mine: OtherRun[];
  let others: OtherRun[];
  try {
    [mine, others] = await Promise.all([
      MY_WF ? fetchRuns(MY_WF) : Promise.resolve([]),
      fetchRuns(OTHER_WF),
    ]);
  } catch (e) {
    console.log(`⚠️  실행 목록 조회 실패 — 중복 검사를 건너뛴다: ${(e as Error).message}`);
    out("skip", "false");
    return;
  }

  // ② 같은 슬롯이 같은 날짜를 이미 올렸는가(진짜 중복).
  const dup = findSameSlotDuplicate(myTarget, offsetOf(MY_WF), mine, now);
  if (dup) {
    out("other_run", dup.html_url ?? "");
    skip(
      `${MY_WF} 가 ${dup.run_started_at} 에 이미 ${myTarget} 를 올렸다(같은 슬롯 중복). ` +
        `${dup.html_url ?? ""}`,
    );
    return;
  }

  // ③ 상대 슬롯과 너무 붙어 있는가. 날짜가 같은 건 정상이고, 간격만 본다.
  const close = findTooCloseRun(myTarget, offsetOf(OTHER_WF), others, now);
  if (close) {
    out("other_run", close.html_url ?? "");
    skip(
      `${OTHER_WF} 가 ${close.run_started_at} 에 ${myTarget} 를 올렸다 — ` +
        `${MIN_GAP_HOURS}시간도 안 지났다. 붙여서 두 번 올리면 피드 배포가 끊긴다(작업82). ` +
        `${close.html_url ?? ""}`,
    );
    return;
  }

  const postedOthers = others.filter((r) => r.posted !== false).length;
  console.log(
    `✅ 창 안 · 같은 슬롯 ${myTarget} 기록 없음 · 상대 슬롯 최근 ${MIN_GAP_HOURS}시간 내 겹침 없음 ` +
      `(상대 게시 실행 ${postedOthers}건 확인) — 게시 진행.`,
  );
  out("skip", "false");
}

main().catch((e) => {
  console.log(`⚠️  사이클 검사 자체가 실패 — 게시는 진행한다: ${(e as Error).message}`);
  out("skip", "false");
});

/**
 * 이 실행이 **지금 게시해도 되는지** 판정해 `skip` / `reason` 을 출력한다.
 *
 * 🔴 지켜야 할 세트 (운영자 정의): 아침 = 오늘 경기 / 저녁 = 내일 경기.
 *
 * GH Actions cron 은 발화 시각을 보장하지 않는다(이 레포 실측 최대 12시간).
 * 2026-08-28 저녁분이 KST 8/29 04:27 에 발화해, 사이클 보정으로 날짜(8/29)는
 * 맞았지만 **새벽 4시에 "저녁 게시물"이 나갔고** 30분 뒤 아침분이 같은 8/29 를
 * 또 올릴 상황이었다. 날짜만 맞추는 것으로는 세트가 안 지켜진다.
 *
 * 막는 것 둘.
 *   ① 사이클 창 밖 예약 발화 — 저녁이 자정 넘겨 돌면, 아침이 저녁까지 밀리면 게시 중단.
 *      수동 실행(workflow_dispatch)은 복구 수단이므로 이 검사를 통과시킨다.
 *   ② 날짜 중복 — 상대 워크플로가 최근에 같은 날짜를 이미 올렸으면 게시 중단.
 *
 * 🔴 fail-open. 조회가 실패하면 게시를 막지 않는다. 감시가 잘못 돌아
 * 하루치 게시가 통째로 사라지는 쪽이, 중복 한 번보다 나쁘다.
 */
import fs from "fs";
import { getKstToday, kstNow } from "../lib/instagram";
import { getPostSlot } from "../lib/post-slot";
import {
  findDuplicateRun,
  isInCycleWindow,
  LOOKBACK_HOURS,
  MORNING_LATEST_HOUR,
  type OtherRun,
} from "../lib/post-duplicate";

const MY_WF = process.env.HHS_WORKFLOW ?? "";
const OTHER_WF = MY_WF === "instagram.yml" ? "instagram-morning.yml" : "instagram.yml";
/** 상대 워크플로의 KST_OFFSET_DAYS. 아침=0, 저녁=1. */
const OTHER_OFFSET = OTHER_WF === "instagram.yml" ? 1 : 0;

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

async function main() {
  const now = new Date();
  const k = kstNow(now);
  const { today: myTarget } = getKstToday(undefined, now);
  const slot = getPostSlot(myTarget);
  out("target", myTarget);
  console.log(`🗓️  대상 ${myTarget} · slot=${slot} · KST ${k.getHours()}시 (${MY_WF || "unset"})`);

  // 🔴 수동 실행(workflow_dispatch)은 **두 검사 모두** 통과시킨다.
  // 이게 사고 복구 수단이다 — 여기서 막으면 잘못 올라간 날 다시 올릴 방법이 없어진다.
  if (process.env.GITHUB_EVENT_NAME === "workflow_dispatch") {
    console.log("🖐️  수동 실행 — 사이클 창·중복 검사를 건너뛴다(복구 경로).");
    out("skip", "false");
    return;
  }

  // ① 사이클 창.
  if (!isInCycleWindow(slot, now)) {
    const window =
      slot === "morning" ? `KST 00~${MORNING_LATEST_HOUR}시` : "KST 12~24시";
    skip(
      `${slot === "morning" ? "아침(오늘치)" : "저녁(내일치)"} 사이클이 창(${window}) 밖 ` +
        `KST ${k.getHours()}시에 발화했다. cron 지연으로 남의 시간대로 넘어간 게시물이라 올리지 않는다.`,
    );
    return;
  }

  // ② 날짜 중복.
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
  if (!repo || !token) {
    console.log("ℹ️  레포/토큰이 없어 중복 검사를 건너뛴다(로컬 실행).");
    out("skip", "false");
    return;
  }

  let runs: OtherRun[] = [];
  try {
    const url =
      `https://api.github.com/repos/${repo}/actions/workflows/${OTHER_WF}/runs` +
      `?per_page=10&status=completed`;
    // fetch-cache-ok: GH Actions 전용 스크립트라 Next 런타임 캐시와 무관하다.
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
    runs = ((await res.json()) as { workflow_runs?: OtherRun[] }).workflow_runs ?? [];
  } catch (e) {
    console.log(`⚠️  ${OTHER_WF} 조회 실패 — 중복 검사를 건너뛴다: ${(e as Error).message}`);
    out("skip", "false");
    return;
  }

  const hit = findDuplicateRun(myTarget, OTHER_OFFSET, runs, now);
  if (hit) {
    out("other_run", hit.html_url ?? "");
    skip(
      `${OTHER_WF} 가 ${hit.run_started_at} 에 이미 ${myTarget} 를 올렸다. ` +
        `같은 날짜를 두 번 올리면 피드 배포가 끊긴다(작업82). ${hit.html_url ?? ""}`,
    );
    return;
  }

  console.log(`✅ 창 안이고 최근 ${LOOKBACK_HOURS}시간에 ${myTarget} 기록 없음 — 게시 진행.`);
  out("skip", "false");
}

main().catch((e) => {
  console.log(`⚠️  사이클 검사 자체가 실패 — 게시는 진행한다: ${(e as Error).message}`);
  out("skip", "false");
});

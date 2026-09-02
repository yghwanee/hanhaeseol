/**
 * 놓친 소셜 게시를 대신 발동한다(따라잡기).
 *
 * 자기 cron 을 갖지 않는다 — GH Actions 가 이 레포의 schedule 을 대량으로 버리기
 * 때문에, 따라잡기 전용 cron 을 만들어 봐야 같이 버려진다(2026-09-01 실측).
 * 대신 **그날 살아남아 실제로 도는** 워크플로들(deploy·crawl-results·uptime)이
 * 끝에서 이걸 호출한다. 하나만 살아남아도 그 사이클은 구제된다.
 *
 * 판정은 src/lib/post-catchup.ts (게이트와 같은 함수). 여기서는 조회·발동·알림만 한다.
 *
 * 🔴 발동은 `gated=true` 로 건다. 그래야 대상 워크플로가 수동 실행 면제를 받지 않고
 *    창·중복 검사를 다시 통과해야 게시한다. 두 따라잡기가 동시에 걸려도 거기서 걸린다.
 */
import { pickCatchupCycle } from "../lib/post-catchup";
import type { OtherRun } from "../lib/post-duplicate";
import { MORNING_WF, EVENING_WF } from "../lib/post-catchup";
import { fetchPostRuns, gh, ghReady, isWorkflowRunning } from "./_post-runs";
import { missingChannels } from "../lib/post-log";
import { channelsForSlot } from "../lib/post-report";
import type { PostSlot } from "../lib/post-slot";
import { loadPostLog } from "./_post-log-store";

const REPO = process.env.GITHUB_REPOSITORY ?? "";
const REF = process.env.HHS_CATCHUP_REF ?? "main";
const DRY = process.env.HHS_CATCHUP_DRY_RUN === "1";

async function main() {
  if (!ghReady()) {
    console.log("ℹ️  레포/토큰이 없어 따라잡기를 건너뛴다(로컬 실행).");
    return;
  }

  const now = new Date();
  const log = await loadPostLog();
  const complete = (slot: PostSlot, target: string) =>
    missingChannels(log, target, slot, channelsForSlot(slot)).length === 0;

  // 🔴 실행 이력 조회를 뒤로 미룬다 (2026-09-02 최적화).
  //
  // 이 스크립트는 살아남은 워크플로들이 부르므로 하루 20회 넘게 돈다. 그런데
  // `fetchPostRuns` 는 워크플로당 실행 목록 1회 + **완료된 실행마다 jobs 조회 1회**라
  // 한 번에 20건 넘게 API 를 때린다. 거의 모든 호출에서 답은 "놓친 것 없음"인데
  // 그걸 알아내려고 매번 그 비용을 냈다.
  //
  // post-log 와 사이클 창만으로 후보가 아예 없으면 거기서 끝낸다. 후보가 있을 때만
  // 실행 이력·진행 중 여부를 확인해 최종 판정한다. **판정 함수는 그대로**라
  // 게이트(check-post-cycle)와 조건이 갈릴 여지는 없다.
  const empty: Record<string, OtherRun[]> = {};
  const rough = pickCatchupCycle(now, empty, { isCycleComplete: complete });
  if (!rough.pick) {
    for (const l of rough.lines) console.log(`  ${l}`);
    console.log("✅ 놓친 사이클 없음 — 발동하지 않는다(실행 이력 조회 생략).");
    return;
  }

  const [morning, evening, morningBusy, eveningBusy] = await Promise.all([
    fetchPostRuns(MORNING_WF),
    fetchPostRuns(EVENING_WF),
    isWorkflowRunning(MORNING_WF),
    isWorkflowRunning(EVENING_WF),
  ]);
  const runs: Record<string, OtherRun[]> = { [MORNING_WF]: morning, [EVENING_WF]: evening };
  const busy: Record<string, boolean> = {
    [MORNING_WF]: morningBusy,
    [EVENING_WF]: eveningBusy,
  };

  const { pick, lines } = pickCatchupCycle(now, runs, {
    isCycleComplete: complete,
    isRunning: (wf: string) => busy[wf] === true,
  });
  for (const l of lines) console.log(`  ${l}`);

  if (!pick) {
    console.log("✅ 놓친 사이클 없음 — 발동하지 않는다.");
    return;
  }

  console.log(`🚑 ${pick.workflow} 를 ${pick.target} 대상으로 발동한다 (ref=${REF}).`);
  if (DRY) {
    console.log("   (dry-run — 실제 발동하지 않음)");
    return;
  }

  await gh(`/repos/${REPO}/actions/workflows/${pick.workflow}/dispatches`, {
    method: "POST",
    body: JSON.stringify({ ref: REF, inputs: { gated: "true" } }),
  });

  // 🔴 여기서 텔레그램을 보내지 않는다 (2026-09-02).
  // GH 가 예약 발화를 대량으로 버리는 지금, 따라잡기는 예외 상황이 아니라 **정상
  // 경로**다. 하루에 여러 번 걸리는 것이 정상이므로 알리면 그게 곧 알림 폭풍이다.
  // 게시가 실제로 되면 telegram:report 가 한 통 보내고, 끝내 안 되면
  // post-watchdog 이 사이클 마감에 한 통 보낸다. 사람이 볼 통지는 그 둘로 충분하다.
  console.log("✅ 발동 완료 (알림 없음 — 정상 경로).");
}

main().catch((e) => {
  console.error(`::error::따라잡기 실패: ${(e as Error).message}`);
  process.exitCode = 1;
});

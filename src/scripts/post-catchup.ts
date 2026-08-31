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
import { fetchPostRuns, gh, ghReady } from "./_post-runs";

const REPO = process.env.GITHUB_REPOSITORY ?? "";
const REF = process.env.HHS_CATCHUP_REF ?? "main";
const DRY = process.env.HHS_CATCHUP_DRY_RUN === "1";

async function tg(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chat = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chat) return;
  try {
    // fetch-cache-ok: GH Actions 전용 스크립트.
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chat, text }),
    });
  } catch {
    /* 알림 실패로 따라잡기를 죽이지 않는다 */
  }
}

async function main() {
  if (!ghReady()) {
    console.log("ℹ️  레포/토큰이 없어 따라잡기를 건너뛴다(로컬 실행).");
    return;
  }

  const now = new Date();
  const [morning, evening] = await Promise.all([
    fetchPostRuns(MORNING_WF),
    fetchPostRuns(EVENING_WF),
  ]);
  const runs: Record<string, OtherRun[]> = { [MORNING_WF]: morning, [EVENING_WF]: evening };

  const { pick, lines } = pickCatchupCycle(now, runs);
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

  const label = pick.slot === "morning" ? "☀️ 아침(오늘 경기)" : "🌙 저녁(내일 경기)";
  await tg(
    [
      `🚑 소셜 게시 따라잡기 — ${label}`,
      "",
      `예약 cron 이 안 돌아서 ${pick.target} 게시가 비어 있었습니다.`,
      `${pick.workflow} 를 대신 발동했습니다.`,
      "",
      `https://github.com/${REPO}/actions/workflows/${pick.workflow}`,
    ].join("\n"),
  );
  console.log("✅ 발동 완료.");
}

main().catch((e) => {
  console.error(`::error::따라잡기 실패: ${(e as Error).message}`);
  process.exitCode = 1;
});

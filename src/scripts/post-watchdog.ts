/**
 * 사이클 마감 점검 — **짖기 전에 직접 돌린다.**
 *
 * 종전(bash)은 GH 실행 이력을 훑어 "게시 스텝이 하나라도 성공했는가" 만 봤다.
 * 그래서 ①5개 중 3개만 올라간 날을 정상으로 통과시켰고 ②문제를 발견해도
 * "gh workflow run 하세요" 라고 사람에게 미뤘다. 그 문장이 그대로 알림이 됐다.
 *
 * 이제 판정은 post-log 의 **채널 단위**다:
 *
 *   빠진 채널 없음                 → 조용히 끝낸다
 *   빠졌고 아직 복구를 안 걸었다   → 복구 발동(dispatch), 알리지 않는다
 *   빠졌고 복구를 이미 걸었었다    → 이때만 한 통 보낸다 (사이클당 1회)
 *
 * dispatch 가 안전한 이유는 게시 스크립트가 post-log 를 보고 이미 올라간 채널을
 * 스스로 건너뛰기 때문이다 — 3개 성공 + 2개 실패면 그 2개만 다시 시도한다.
 *
 * 실행: `npm run post:watchdog`  (입력: HHS_WATCHDOG_CYCLE=morning|evening, HHS_WATCHDOG_DRY_RUN=1)
 */
import { getKstToday, kstNow } from "../lib/instagram";
import type { PostSlot } from "../lib/post-slot";
import { missingChannels, markNotified, wasNotified } from "../lib/post-log";
import { MORNING_LATEST_HOUR } from "../lib/post-duplicate";
import { CATCHUP_EARLIEST_HOUR } from "../lib/post-catchup";
import { CHANNEL_LABEL, channelsForSlot } from "../lib/post-report";
import { MORNING_WF, EVENING_WF } from "../lib/post-catchup";
import { gh, ghReady, isWorkflowRunning } from "./_post-runs";
import { loadPostLog, updatePostLog } from "./_post-log-store";
import { sendTelegramText, telegramConfigured } from "./_telegram";

const REPO = process.env.GITHUB_REPOSITORY ?? "";
const REF = process.env.HHS_CATCHUP_REF ?? "main";
const DRY = process.env.HHS_WATCHDOG_DRY_RUN === "1";

/**
 * 점검할 사이클.
 *
 * 🔴 시각 판정을 `hour < 12 ? morning : evening` 으로 두면 **정오 점검이 저녁을 본다.**
 * 낮 크론이 KST 12:07 이라 12시가 evening 으로 떨어지고, 저녁 예약(16:18)이 오기도
 * 전에 복구를 걸어 낮에 내일치를 올려 버린다(2026-09-02 검증에서 잡았다).
 * 낮 점검은 **아침 사이클 마감**용이므로 아침 창이 닫히는 시각(MORNING_LATEST_HOUR)을
 * 경계로 쓴다. 워크플로가 크론별로 HHS_WATCHDOG_CYCLE 을 넘겨주면 그게 우선이다.
 */
function pickCycle(now: Date): PostSlot {
  const forced = process.env.HHS_WATCHDOG_CYCLE?.trim();
  if (forced === "morning" || forced === "evening") return forced;
  return kstNow(now).getHours() < MORNING_LATEST_HOUR ? "morning" : "evening";
}

async function main() {
  const now = new Date();
  const slot = pickCycle(now);
  const offset = slot === "morning" ? 0 : 1;
  const target = getKstToday(offset, now).today;
  const workflow = slot === "morning" ? MORNING_WF : EVENING_WF;
  const label = slot === "morning" ? "☀️ 아침(오늘 경기)" : "🌙 저녁(내일 경기)";

  console.log(`🗓️  ${label} · 대상 ${target} · KST ${kstNow(now).getHours()}시`);

  const log = await loadPostLog();
  const expected = channelsForSlot(slot);
  const missing = missingChannels(log, target, slot, expected);

  if (missing.length === 0) {
    console.log(`✅ ${target}(${slot}) ${expected.length}개 채널 전부 올라감 — 알릴 것 없음.`);
    return;
  }
  console.log(`⚠️  빠진 채널: ${missing.map((c) => CHANNEL_LABEL[c]).join(", ")}`);

  if (!ghReady()) {
    console.log("ℹ️  레포/토큰이 없어 복구를 걸 수 없다(로컬 실행).");
    return;
  }

  const triedRecover = wasNotified(log, target, slot, "recover");

  // 🔴 예약 발화를 앞지르지 않는다. 따라잡기와 같은 기준을 쓴다 — 여기만 다르면
  // 감시견이 낮에 내일치를 올려 버린다.
  const hour = kstNow(now).getHours();
  if (hour < CATCHUP_EARLIEST_HOUR[slot]) {
    console.log(`ℹ️  KST ${hour}시 — 예약(${CATCHUP_EARLIEST_HOUR[slot]}시 전)이라 아직 판단하지 않는다.`);
    return;
  }

  // ① 아직 복구를 안 걸었다 → 조용히 한 번 건다.
  if (!triedRecover) {
    if (await isWorkflowRunning(workflow)) {
      console.log(`ℹ️  ${workflow} 가 지금 돌고 있다 — 그 결과를 기다린다.`);
      return;
    }
    console.log(`🚑 ${workflow} 복구 발동 (${target}).`);
    if (DRY) {
      console.log("   (dry-run — 실제 발동하지 않음)");
      return;
    }
    await gh(`/repos/${REPO}/actions/workflows/${workflow}/dispatches`, {
      method: "POST",
      body: JSON.stringify({ ref: REF, inputs: { gated: "true" } }),
    });
    await updatePostLog(
      (remote) => markNotified(remote, target, slot, "recover"),
      `chore(post-log): recover dispatched ${target} ${slot}`,
      target,
    );
    console.log("✅ 복구 발동 완료 — 알림 없음(결과는 게시 보고가 알린다).");
    return;
  }

  // ② 복구를 걸었는데도 여전히 빠져 있다 → 이때만 사람을 부른다. 사이클당 한 통.
  if (wasNotified(log, target, slot, "watchdog")) {
    console.log("🔇 이미 경고를 보냈다 — 하루 한 통 규칙에 따라 침묵.");
    return;
  }
  if (DRY) {
    console.log("   (dry-run — 경고를 보내지 않음)");
    return;
  }

  if (!telegramConfigured()) {
    console.log("ℹ️  텔레그램 설정이 없어 경고를 건너뛴다(로컬 실행).");
    return;
  }
  await sendTelegramText(
    [
      `⚠️ 소셜 게시가 끝내 안 올라갔습니다 — ${label} ${target}`,
      "",
      `빠진 채널: ${missing.map((c) => CHANNEL_LABEL[c]).join(", ")}`,
      "자동 복구를 한 번 걸었는데도 채워지지 않았습니다.",
      "",
      "재실행 (이미 올라간 채널은 자동으로 건너뜁니다):",
      `gh workflow run ${workflow}`,
      "",
      `https://github.com/${REPO}/actions/workflows/${workflow}`,
    ].join("\n"),
  );
  await updatePostLog(
    (remote) => markNotified(remote, target, slot, "watchdog"),
    `chore(post-log): watchdog notified ${target} ${slot}`,
    target,
  );
}

main().catch((e) => {
  console.error(`::error::감시견 실패: ${(e as Error).message}`);
  process.exitCode = 1;
});

/**
 * 게시 채널 하나를 실행한다. 중복 방지가 붙은 유일한 진입점이다.
 *
 * 순서:
 *   ① post-log 에 `날짜|슬롯|채널` 기록이 있으면 **아무것도 하지 않고** 성공으로 끝낸다.
 *   ② 없으면 게시하고, 성공하는 즉시 기록을 커밋한다.
 *
 * 🔴 ②의 "즉시" 가 핵심이다. 실행이 중간에 죽어도 이미 올라간 채널은 기록에 남아
 *    다음 실행이 건너뛴다. 실행 끝에 몰아서 커밋하면 죽는 순간 기록이 통째로 사라져
 *    재실행이 전부를 다시 올린다 — fadeby 가 그 함정에 빠졌었다(generated/ 는 gitignore).
 *
 * 🔴 기록 실패로 프로세스를 죽이지 않는다. 게시는 이미 끝났으므로 여기서 빨간불을
 *    내면 사람이 재실행해서 중복 게시를 만든다.
 */
import { currentCycle } from "@/lib/post-slot";
import { markPosted, wasPosted, type PostLog } from "@/lib/post-log";
import { recordResult, CHANNEL_LABEL, type Channel } from "@/lib/post-report";
import { loadPostLog, updatePostLog } from "./_post-log-store";

export async function runChannel(
  channel: Channel,
  fn: () => Promise<string | void>,
): Promise<void> {
  const { today, slot } = currentCycle();

  let log: PostLog;
  try {
    log = await loadPostLog();
  } catch {
    // fail-open. 기록을 못 읽었다고 게시를 멈추면 그날 콘텐츠가 통째로 없어진다.
    log = { posted: {}, notified: {} };
  }

  if (wasPosted(log, today, slot, channel)) {
    console.log(
      `⏭️  ${CHANNEL_LABEL[channel]} — ${today}(${slot}) 은 이미 게시됐다. 건너뛴다(중복 방지).`,
    );
    recordResult(channel, "ok", "이미 게시됨 — 이번 실행에서는 건너뜀", false);
    return;
  }

  let detail: string;
  try {
    detail = (await fn()) || "게시 완료";
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    recordResult(channel, "fail", msg);
    console.error("❌", msg);
    process.exit(1);
  }

  recordResult(channel, "ok", detail, true);

  await updatePostLog(
    (remote) =>
      markPosted(remote, today, slot, channel, {
        at: new Date().toISOString(),
        detail,
        run: process.env.GITHUB_RUN_ID,
      }),
    `chore(post-log): ${today} ${slot} ${channel}`,
    today,
  );
  console.log(`📝 post-log 기록: ${today}|${slot}|${channel}`);
}

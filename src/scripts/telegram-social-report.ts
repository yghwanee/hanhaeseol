import fs from "node:fs";
import path from "node:path";
import {
  sendTelegramDocument,
  sendTelegramMediaGroup,
  type MediaItem,
} from "@/lib/instagram";
import { MANIFEST_PATH, OUT_DIR, readManifest } from "@/lib/manifest";
import { formatReport, summarize, type Channel } from "@/lib/post-report";
import { currentCycle } from "@/lib/post-slot";
import { markNotified, wasNotified } from "@/lib/post-log";
import { loadPostLog, updatePostLog } from "./_post-log-store";
import { sendTelegramText } from "./_telegram";

/**
 * 소셜 게시 결과를 텔레그램으로 보고한다.
 *
 * 종전엔 실패 시 "❌ 인스타 카드 생성/게시 실패. 로그 확인." 한 줄이 전부라
 * 5개 채널 중 무엇이 올라갔고 무엇이 빠졌는지 알 수 없었다. 이제
 * 채널별 성공/실패와 실패분만 재실행하는 명령을 함께 보낸다.
 *
 * 사용: `tsx src/scripts/telegram-social-report.ts [--failure]`
 * `--failure` 면 안 올라간 채널의 원본 파일도 첨부해 수동 업로드가 가능하게 한다.
 *
 * 🔴 하루 한 통 규칙 (2026-09-02)
 *
 * GH 크론 드리프트로 따라잡기가 같은 사이클을 여러 번 걸면, 종전에는 실행마다
 * 보고가 나가 하루에 대여섯 통이 쌓였다. 이제 **새 정보가 있을 때만** 보낸다:
 *
 *   · 이번 실행에서 새로 올린 채널이 있다  → 보낸다(복구 결과는 알아야 한다)
 *   · 이 사이클에 아직 한 번도 안 알렸다   → 보낸다(첫 통)
 *   · 둘 다 아니다                          → 침묵
 *
 * 즉 "전부 이미 올라가 있어 건너뛴 재실행" 은 조용하다. 알림 표시는 post-log 의
 * `notified` 에 남으므로 실행이 갈려도 유지된다.
 */

const isFailure = process.argv.includes("--failure");
const TITLE = process.env.HHS_REPORT_TITLE || "소셜";
const WORKFLOW = process.env.HHS_WORKFLOW || "instagram.yml";

/** 안 올라간 채널의 원본 파일만 골라 보낸다 (성공한 채널 파일까지 보내면 노이즈). */
async function sendAssetsFor(channels: Channel[]) {
  if (!fs.existsSync(MANIFEST_PATH)) return;
  const manifest = readManifest();

  if (channels.includes("carousel") && manifest.files.length > 0) {
    const items: MediaItem[] = manifest.files
      .filter((f) => fs.existsSync(path.join(OUT_DIR, f)))
      .map((filename, i) => ({
        buf: fs.readFileSync(path.join(OUT_DIR, filename)),
        filename,
        caption: i === 0 ? "🖼 캐러셀 카드 — 수동 업로드용" : undefined,
      }));
    if (items.length > 0) {
      await sendTelegramMediaGroup(items);
      console.log(`✅ 카드 ${items.length}장 전송`);
    }
  }

  // 릴스·유튜브·틱톡은 같은 영상을 쓴다 — 하나라도 실패했으면 mp4 를 한 번만 보낸다.
  const needsVideo = (["reel", "youtube", "tiktok"] as Channel[]).some((c) => channels.includes(c));
  if (needsVideo && manifest.reel) {
    const p = path.join(OUT_DIR, manifest.reel);
    if (fs.existsSync(p)) {
      // 원본 품질 보존을 위해 document 로 전송 (sendVideo 는 Telegram 이 재압축함)
      await sendTelegramDocument(fs.readFileSync(p), manifest.reel, "🎬 릴스 영상 (원본)");
      console.log(`✅ 릴스 ${manifest.reel} 전송`);
    }
  }

  if (channels.includes("story") && manifest.story) {
    const p = path.join(OUT_DIR, manifest.story);
    if (fs.existsSync(p)) {
      await sendTelegramDocument(fs.readFileSync(p), manifest.story, "📱 스토리 이미지 (원본)");
      console.log(`✅ 스토리 ${manifest.story} 전송`);
    }
  }
}

async function main() {
  const summary = summarize();
  const bad = [...summary.failed, ...summary.skipped];
  const icon = bad.length === 0 ? "✅" : "❌";

  const { today, slot } = currentCycle();
  const log = await loadPostLog();
  const alreadyNotified = wasNotified(log, today, slot, "report");

  if (summary.fresh.length === 0 && alreadyNotified) {
    console.log(
      `🔇 새로 올린 채널이 없고 ${today}(${slot}) 보고는 이미 보냈다 — 알리지 않는다.`,
    );
    return;
  }

  await sendTelegramText(`${icon} ${formatReport({ summary, title: TITLE, workflow: WORKFLOW })}`);
  console.log(
    `✅ 보고 전송: ${summary.ok.length}/${summary.total} 성공 (새로 올림 ${summary.fresh.length})`,
  );

  // 🔴 보낸 뒤에 기록한다. 전송이 실패하면 표시가 남지 않아 다음 실행이 다시 시도한다.
  await updatePostLog(
    (remote) => markNotified(remote, today, slot, "report"),
    `chore(post-log): notified ${today} ${slot}`,
    today,
  );

  if (isFailure && bad.length > 0) {
    await sendAssetsFor(bad);
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});

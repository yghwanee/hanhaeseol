import fs from "node:fs";
import path from "node:path";
import {
  sendTelegramDocument,
  sendTelegramMediaGroup,
  type MediaItem,
} from "@/lib/instagram";
import { MANIFEST_PATH, OUT_DIR, readManifest } from "@/lib/manifest";
import { formatReport, summarize, type Channel } from "@/lib/post-report";

/**
 * 소셜 게시 결과를 텔레그램으로 보고한다.
 *
 * 종전엔 실패 시 "❌ 인스타 카드 생성/게시 실패. 로그 확인." 한 줄이 전부라
 * 5개 채널 중 무엇이 올라갔고 무엇이 빠졌는지 알 수 없었다. 이제
 * 채널별 성공/실패와 실패분만 재실행하는 명령을 함께 보낸다.
 *
 * 사용: `tsx src/scripts/telegram-social-report.ts [--failure]`
 * `--failure` 면 안 올라간 채널의 원본 파일도 첨부해 수동 업로드가 가능하게 한다.
 */

const isFailure = process.argv.includes("--failure");
const TITLE = process.env.HHS_REPORT_TITLE || "소셜";
const WORKFLOW = process.env.HHS_WORKFLOW || "instagram.yml";

async function sendText(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) throw new Error("TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID 없음");

  // 텔레그램 본문 한도는 4096자. 채널 보고는 짧지만 에러 메시지가 길어질 수 있어 자른다.
  const body = text.length > 4000 ? `${text.slice(0, 3990)}\n…(생략)` : text;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text: body }),
  });
  const json = (await res.json().catch(() => ({}))) as { ok?: boolean };
  if (!res.ok || json.ok !== true) {
    throw new Error(`Telegram 텍스트 전송 실패: ${res.status} ${JSON.stringify(json)}`);
  }
}

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

  await sendText(`${icon} ${formatReport({ summary, title: TITLE, workflow: WORKFLOW })}`);
  console.log(`✅ 보고 전송: ${summary.ok.length}/${summary.total} 성공`);

  if (isFailure && bad.length > 0) {
    await sendAssetsFor(bad);
  }
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});

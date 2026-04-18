import fs from "node:fs";
import path from "node:path";
import { getKstToday } from "@/lib/instagram";
import { buildCaption, mediaBaseUrl, postMedia, publish, waitForFinished } from "@/lib/instagram-api";

async function main() {
  const manifestPath = path.resolve("generated/instagram/manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("매니페스트 없음");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { reel?: string };
  if (!manifest.reel) throw new Error("매니페스트에 reel 필드 없음 — 먼저 reel:make 실행 필요");

  const videoUrl = `${mediaBaseUrl()}/${manifest.reel}`;
  const { mm, dd } = getKstToday();

  console.log(`🎬 릴스 게시 시작: ${videoUrl}`);

  const reelId = await postMedia({
    media_type: "REELS",
    video_url: videoUrl,
    caption: buildCaption(mm, dd),
    share_to_feed: "false",
  });
  console.log(`  컨테이너 생성: ${reelId}`);

  // 비디오는 트랜스코딩 시간이 길어 넉넉히 대기 (최대 ~3분)
  await waitForFinished(reelId, 60, 3000);

  const mediaId = await publish(reelId);
  console.log(`✅ 릴스 게시 완료. Media ID: ${mediaId}`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});

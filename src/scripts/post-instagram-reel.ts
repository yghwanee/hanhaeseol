import { getKstToday } from "@/lib/instagram";
import { buildCaption, mediaBaseUrl, publishSingleMedia } from "@/lib/instagram-api";
import { readManifest } from "@/lib/manifest";

async function main() {
  const manifest = readManifest();
  if (!manifest.reel) throw new Error("매니페스트에 reel 필드 없음 — 먼저 reel:make 실행 필요");

  const { mm, dd } = getKstToday();
  const videoUrl = `${mediaBaseUrl()}/${manifest.reel}`;
  console.log(`🎬 릴스 게시 시작: ${videoUrl}`);

  // 비디오 트랜스코딩 대기는 최대 ~3분
  const mediaId = await publishSingleMedia(
    {
      media_type: "REELS",
      video_url: videoUrl,
      caption: buildCaption(mm, dd),
      share_to_feed: "false",
    },
    60,
  );
  console.log(`✅ 릴스 게시 완료. Media ID: ${mediaId}`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});

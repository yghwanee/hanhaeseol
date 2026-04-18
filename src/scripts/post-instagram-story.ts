import { mediaBaseUrl, publishSingleMedia } from "@/lib/instagram-api";
import { readManifest } from "@/lib/manifest";

async function main() {
  const manifest = readManifest();
  if (!manifest.story) throw new Error("매니페스트에 story 필드 없음 — 먼저 story:make 실행 필요");

  const imageUrl = `${mediaBaseUrl()}/${manifest.story}`;
  console.log(`📱 스토리 게시 시작: ${imageUrl}`);

  const mediaId = await publishSingleMedia({
    media_type: "STORIES",
    image_url: imageUrl,
  });
  console.log(`✅ 스토리 게시 완료. Media ID: ${mediaId}`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});

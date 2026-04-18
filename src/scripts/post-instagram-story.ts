import fs from "node:fs";
import path from "node:path";
import { mediaBaseUrl, postMedia, publish, waitForFinished } from "@/lib/instagram-api";

async function main() {
  const manifestPath = path.resolve("generated/instagram/manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("매니페스트 없음");

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { story?: string };
  if (!manifest.story) throw new Error("매니페스트에 story 필드 없음 — 먼저 story:make 실행 필요");

  const imageUrl = `${mediaBaseUrl()}/${manifest.story}`;
  console.log(`📱 스토리 게시 시작: ${imageUrl}`);

  const storyId = await postMedia({
    media_type: "STORIES",
    image_url: imageUrl,
  });
  await waitForFinished(storyId);

  const mediaId = await publish(storyId);
  console.log(`✅ 스토리 게시 완료. Media ID: ${mediaId}`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});

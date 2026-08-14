import { igImageName } from "@/lib/ig-image";
import { mediaBaseUrl, publishSingleMedia } from "@/lib/instagram-api";
import { readManifest } from "@/lib/manifest";
import { runWithReport } from "@/lib/post-report";
import { UTM_LINKS } from "@/lib/utm";

const STORY_LINK = UTM_LINKS.ig_story;

async function main(): Promise<string> {
  const manifest = readManifest();
  if (!manifest.story) throw new Error("매니페스트에 story 필드 없음 — 먼저 story:make 실행 필요");

  const imageUrl = `${mediaBaseUrl()}/${igImageName(manifest.story, manifest)}`;
  console.log(`📱 스토리 게시 시작: ${imageUrl}`);

  // 1차 시도: link sticker 포함. API가 거부하면 2차 폴백으로 일반 스토리 게시.
  try {
    const mediaId = await publishSingleMedia({
      media_type: "STORIES",
      image_url: imageUrl,
      link: STORY_LINK,
    });
    console.log(`✅ 스토리 게시 완료 (link sticker O). Media ID: ${mediaId}`);
    return `Media ID ${mediaId} (link sticker O)`;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn(`⚠️  link sticker 시도 실패, 폴백 진행: ${msg}`);
  }

  const mediaId = await publishSingleMedia({
    media_type: "STORIES",
    image_url: imageUrl,
  });
  console.log(`✅ 스토리 게시 완료 (link sticker X, 폴백). Media ID: ${mediaId}`);
  return `Media ID ${mediaId} (link sticker X, 폴백)`;
}

runWithReport("story", main);

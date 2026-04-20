import { getKstToday } from "@/lib/instagram";
import { buildCaption, comment, mediaBaseUrl, postMedia, publish, waitForFinished } from "@/lib/instagram-api";
import { readManifest } from "@/lib/manifest";
import { FIXED_COMMENT } from "@/lib/social-comment";

const MAX_CAROUSEL = 10;

async function main() {
  const { files } = readManifest();
  if (files.length === 0) throw new Error("매니페스트에 파일이 없습니다.");

  const selected = files.length > MAX_CAROUSEL
    ? (console.warn(`⚠️  ${files.length}장 → 최대 ${MAX_CAROUSEL}장으로 자름`), files.slice(0, MAX_CAROUSEL))
    : files;

  const base = mediaBaseUrl();
  const urls = selected.map((f) => `${base}/${f}`);

  console.log(`📸 캐러셀 ${urls.length}장 게시 시작`);

  const itemIds = await Promise.all(
    urls.map((image_url) => postMedia({ image_url, is_carousel_item: "true" })),
  );
  await Promise.all(itemIds.map((id) => waitForFinished(id)));

  const { mm, dd } = getKstToday();
  const carouselId = await postMedia({
    media_type: "CAROUSEL",
    children: itemIds.join(","),
    caption: buildCaption(mm, dd),
  });
  await waitForFinished(carouselId);

  const mediaId = await publish(carouselId);
  console.log(`✅ 캐러셀 게시 완료. Media ID: ${mediaId}`);

  await comment(mediaId, FIXED_COMMENT);
  console.log(`💬 댓글 작성 완료`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});

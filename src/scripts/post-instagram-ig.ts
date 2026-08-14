import { igImageName } from "@/lib/ig-image";
import { getKstToday } from "@/lib/instagram";
import { buildCaption, comment, createFinishedContainer, mediaBaseUrl, publish } from "@/lib/instagram-api";
import { readManifest } from "@/lib/manifest";
import { runWithReport } from "@/lib/post-report";
import { buildSocialComment } from "@/lib/social-comment";
import { UTM_LINKS } from "@/lib/utm";

const MAX_CAROUSEL = 10;

async function main(): Promise<string> {
  const manifest = readManifest();
  const { files } = manifest;
  if (files.length === 0) throw new Error("매니페스트에 파일이 없습니다.");

  const selected = files.length > MAX_CAROUSEL
    ? (console.warn(`⚠️  ${files.length}장 → 최대 ${MAX_CAROUSEL}장으로 자름`), files.slice(0, MAX_CAROUSEL))
    : files;

  const base = mediaBaseUrl();
  // PNG 가 아니라 JPEG 트윈을 올린다 — Meta 의 PNG→JPEG 변환이 2026-08-15 아침에
  // 통째로 죽었다(36001/2207084). 상세는 `src/lib/ig-image.ts`.
  const urls = selected.map((f) => `${base}/${igImageName(f, manifest)}`);

  console.log(`📸 캐러셀 ${urls.length}장 게시 시작`);

  // 개별 아이템도 트랜스코딩 실패(2207052 등)를 맞을 수 있어 컨테이너 단위 재시도를 태운다.
  const itemIds = await Promise.all(
    urls.map((image_url) => createFinishedContainer({ image_url, is_carousel_item: "true" })),
  );

  const { today, mm, dd } = getKstToday();
  const carouselId = await createFinishedContainer({
    media_type: "CAROUSEL",
    children: itemIds.join(","),
    caption: buildCaption(mm, dd, today, UTM_LINKS.ig_post, "feed"),
  });

  const mediaId = await publish(carouselId);
  console.log(`✅ 캐러셀 게시 완료. Media ID: ${mediaId}`);

  // 댓글 실패는 비치명 처리 — 게시는 이미 완료라 여기서 exit 1 나면
  // 재실행 시 같은 캐러셀이 중복 게시됨.
  try {
    await comment(mediaId, buildSocialComment(today));
    console.log(`💬 댓글 작성 완료`);
  } catch (e) {
    console.warn(`⚠️  댓글 작성 실패(게시는 완료): ${e instanceof Error ? e.message : e}`);
  }

  return `Media ID ${mediaId} (${urls.length}장)`;
}

runWithReport("carousel", main);

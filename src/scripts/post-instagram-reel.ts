import { getKstToday } from "@/lib/instagram";
import { buildCaption, comment, mediaBaseUrl, publishSingleMedia } from "@/lib/instagram-api";
import { readManifest } from "@/lib/manifest";
import { runWithReport } from "@/lib/post-report";
import { buildSocialComment } from "@/lib/social-comment";
import { UTM_LINKS } from "@/lib/utm";

async function main(): Promise<string> {
  const manifest = readManifest();
  if (!manifest.reel) throw new Error("매니페스트에 reel 필드 없음 — 먼저 reel:make 실행 필요");

  const { today, mm, dd } = getKstToday();
  const videoUrl = `${mediaBaseUrl()}/${manifest.reel}`;
  console.log(`🎬 릴스 게시 시작: ${videoUrl}`);

  // manifest.cover 있으면 인스타 REELS cover_url로 강제 지정 — mp4 첫 프레임 아닌
  // 별도 PNG가 썸네일로 박힘 (탐색기/플랫폼 일관)
  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: videoUrl,
    caption: buildCaption(mm, dd, today, UTM_LINKS.ig_reel),
    share_to_feed: "false",
  };
  if (manifest.cover) {
    params.cover_url = `${mediaBaseUrl()}/${manifest.cover}`;
    console.log(`🖼  cover_url: ${params.cover_url}`);
  }

  // 비디오 트랜스코딩 대기는 최대 ~3분
  const mediaId = await publishSingleMedia(params, 60);
  console.log(`✅ 릴스 게시 완료. Media ID: ${mediaId}`);

  // 댓글 실패는 비치명 처리 — 게시는 이미 완료라 여기서 exit 1 나면
  // 재실행 시 같은 릴스가 중복 게시됨.
  try {
    await comment(mediaId, buildSocialComment(today));
    console.log(`💬 댓글 작성 완료`);
  } catch (e) {
    console.warn(`⚠️  댓글 작성 실패(게시는 완료): ${e instanceof Error ? e.message : e}`);
  }

  return `Media ID ${mediaId}`;
}

runWithReport("reel", main);

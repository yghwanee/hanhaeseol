import path from "node:path";
import fs from "node:fs";
import { getKstToday } from "@/lib/instagram";
import { addComment, buildShortsMeta, setThumbnail, uploadShorts } from "@/lib/youtube-api";
import { OUT_DIR, readManifest } from "@/lib/manifest";
import { FIXED_COMMENT } from "@/lib/social-comment";

async function main() {
  const manifest = readManifest();
  if (!manifest.reel) throw new Error("매니페스트에 reel 필드 없음 — 먼저 reel:make 실행 필요");

  const filePath = path.join(OUT_DIR, manifest.reel);
  if (!fs.existsSync(filePath)) throw new Error(`영상 파일 없음: ${filePath}`);

  const thumbFile = manifest.files[0];
  if (!thumbFile) throw new Error("매니페스트 files[0] 없음 — 썸네일 생성 불가");
  const thumbPath = path.join(OUT_DIR, thumbFile);
  if (!fs.existsSync(thumbPath)) throw new Error(`썸네일 파일 없음: ${thumbPath}`);

  const { mm, dd } = getKstToday();
  const meta = buildShortsMeta(mm, dd);
  const sizeMb = (fs.statSync(filePath).size / 1024 / 1024).toFixed(2);

  console.log(`📺 유튜브 쇼츠 업로드 시작 (${sizeMb} MB)`);
  console.log(`   제목: ${meta.title}`);

  const videoId = await uploadShorts({
    filePath,
    title: meta.title,
    description: meta.description,
    tags: meta.tags,
    privacyStatus: "public",
    madeForKids: false,
  });

  console.log(`✅ 유튜브 쇼츠 업로드 완료: https://youtube.com/shorts/${videoId}`);

  console.log(`🖼  썸네일 설정 중... (${thumbFile})`);
  await setThumbnail(videoId, thumbPath);
  console.log(`✅ 썸네일 설정 완료`);

  await addComment(videoId, FIXED_COMMENT);
  console.log(`💬 댓글 작성 완료`);
}

main().catch((e) => {
  console.error("❌", e.message || e);
  process.exit(1);
});

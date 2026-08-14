import fs from "node:fs";
import path from "node:path";
import { writeJpegTwin } from "@/lib/ig-image";
import { OUT_DIR, patchManifest, readManifest } from "@/lib/manifest";

/**
 * 인스타에 올라가는 이미지(캐러셀 전체 + 스토리 + 릴스 커버)를 JPEG 로 한 벌 더 굽는다.
 * PNG 원본은 그대로 둔다 — 릴스/틱톡 영상이 ffmpeg 입력으로 쓴다.
 *
 * 워크플로에서 **insta-media 브랜치 push 직전**에 돌아야 한다. 그래야 JPEG 도 같이
 * 올라가고 게시 스크립트가 CDN 에서 집을 수 있다. 순서는 `test:ig-image` 가 검사한다.
 */
async function main() {
  const manifest = readManifest();

  // 캐러셀(files) + 스토리 + 릴스 커버. cover 는 보통 files 의 main 카드와 같으므로 중복 제거.
  const targets = [...manifest.files, manifest.story, manifest.cover]
    .filter((f): f is string => !!f && /\.png$/i.test(f))
    .filter((f, i, arr) => arr.indexOf(f) === i);

  if (targets.length === 0) {
    throw new Error("JPEG 로 변환할 PNG 가 매니페스트에 없습니다.");
  }

  const jpeg: string[] = [];
  for (const png of targets) {
    const out = await writeJpegTwin(OUT_DIR, png);
    const before = fs.statSync(path.join(OUT_DIR, png)).size;
    const after = fs.statSync(path.join(OUT_DIR, out)).size;
    console.log(
      `  ${png} → ${out}  ${(before / 1024).toFixed(0)}KB → ${(after / 1024).toFixed(0)}KB ` +
        `(${Math.round((after / before) * 100)}%)`,
    );
    jpeg.push(out);
  }

  patchManifest({ jpeg });
  console.log(`✅ 인스타 업로드용 JPEG ${jpeg.length}장 생성 완료`);
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});

import path from "node:path";
import fs from "node:fs";
import { getKstToday } from "@/lib/instagram";
import { addComment, buildShortsMeta, setThumbnail, uploadShorts } from "@/lib/youtube-api";
import { OUT_DIR, readManifest } from "@/lib/manifest";
import { igImageName } from "@/lib/ig-image";
import { runChannel } from "./_run-channel";
import { buildSocialComment } from "@/lib/social-comment";

async function main(): Promise<string> {
  const manifest = readManifest();
  if (!manifest.reel) throw new Error("매니페스트에 reel 필드 없음 — 먼저 reel:make 실행 필요");

  const filePath = path.join(OUT_DIR, manifest.reel);
  if (!fs.existsSync(filePath)) throw new Error(`영상 파일 없음: ${filePath}`);

  // 🔴 쇼츠 썸네일은 9:16 커버를 쓴다 (2026-10-06). 종전엔 4:5 캐러셀 1장(files[0])을 넣어
  // 쇼츠가 9:16 틀에 맞춰 그 가운데를 잘라 보여 줬다("썸네일이 중간부터 나온다").
  // 업로드 한도 2MB 라 JPEG 트윈이 있으면 그걸 쓴다. v3 가 아닌 옛 경로는 cover 가 4:5 라 files[0] 그대로.
  const coverIsTall = !!manifest.cover && manifest.cover.startsWith("v3-cover");
  const thumbFile = coverIsTall ? igImageName(manifest.cover!, manifest) : manifest.files[0];
  if (!thumbFile) throw new Error("매니페스트 files[0] 없음 — 썸네일 생성 불가");
  const thumbPath = path.join(OUT_DIR, thumbFile);
  if (!fs.existsSync(thumbPath)) throw new Error(`썸네일 파일 없음: ${thumbPath}`);

  const { today, mm, dd } = getKstToday();
  const meta = buildShortsMeta(mm, dd, today);
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

  // 🔴 여기서부터는 영상이 이미 공개된 뒤다. 실패해도 throw 하지 않는다 —
  // exit 1 로 끝나면 워크플로가 빨갛게 뜨고, 그걸 보고 재실행하면 같은 영상이
  // 한 번 더 업로드된다. 인스타 댓글에 이미 내린 결정과 같다(2026-08-02).
  //
  // 실제로 2026-08-07 아침에 업로드는 성공했는데 썸네일이 403 하나로 스텝이 죽었다.
  // 직전 6회는 전부 성공했으니 일시 오류다. 그래서 재시도 + 비치명으로 바꾼다.
  await afterPublish("썸네일 설정", () => setThumbnail(videoId, thumbPath), thumbFile);
  await afterPublish("댓글 작성", () => addComment(videoId, buildSocialComment(today)));

  return `https://youtube.com/shorts/${videoId}`;
}

/** 게시 완료 뒤 부가 작업 — 짧게 재시도하고, 끝내 실패해도 경고만 남긴다. */
async function afterPublish(label: string, run: () => Promise<unknown>, note?: string) {
  const delays = [5000, 15000];
  console.log(`🔧 ${label} 중...${note ? ` (${note})` : ""}`);
  for (let attempt = 0; attempt <= delays.length; attempt++) {
    try {
      await run();
      console.log(`✅ ${label} 완료`);
      return;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (attempt === delays.length) {
        console.warn(`⚠️  ${label} 실패(영상 게시는 완료, 계속 진행): ${msg}`);
        return;
      }
      console.warn(`⚠️  ${label} 실패 — ${delays[attempt] / 1000}초 뒤 재시도: ${msg}`);
      await new Promise((r) => setTimeout(r, delays[attempt]));
    }
  }
}

runChannel("youtube", main);

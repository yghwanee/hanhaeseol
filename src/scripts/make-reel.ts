import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { OUT_DIR, patchManifest, readManifest } from "@/lib/manifest";
import { getKstToday, registerFonts } from "@/lib/instagram";
import { renderReelListCards } from "@/lib/reel-list-card";
import { SLOT_ACCENT } from "@/lib/reel-title-card";
import { getPostSlot } from "@/lib/post-slot";

const COVER_DUR = 3.0;     // 첫 프레임(커버) 노출 시간(초)
const LIST_DUR = 3.6;      // 목록 카드 1장(최대 5경기) 노출 시간(초)
const OUTRO_DUR = 2.5;     // 아웃트로 노출 시간(초)
const XFADE = 0.6;         // 크로스페이드 길이(초)
const WIDTH = 1080;
const HEIGHT = 1920;
const OUTPUT = "reel.mp4";
const BGM_REL = "assets/bgm.mp3";

function main() {
  const { files } = readManifest();
  if (files.length === 0) throw new Error("카드 없음");

  const bgmPath = path.resolve(BGM_REL);
  if (!fs.existsSync(bgmPath)) throw new Error(`BGM 없음: ${bgmPath}`);

  // 첫 번째 파일이 main-MMDD.png 면, 영상 세이프존용 main-reel-MMDD.png
  // (PAD=85)이 같은 폴더에 있으면 그걸 첫 프레임으로 쓴다. 없으면 fallback.
  const cover = (() => {
    const f = files[0];
    const reelVariant = f.replace(/^main-/, "main-reel-");
    return fs.existsSync(path.join(OUT_DIR, reelVariant)) ? reelVariant : f;
  })();

  // 본문 — 9:16 목록 카드. 종전엔 캐러셀용 4:5 종목 카드를 그대로 넣어 위아래 검은 띠 +
  // 36px 글자를 2.5초씩 보여 줬다(읽을 수 없다). 캐러셀 게시물은 그 카드를 그대로 쓴다.
  registerFonts();
  const { today } = getKstToday();
  const listFiles = renderReelListCards(today, { accent: SLOT_ACCENT[getPostSlot(today)] }).map(
    (buf, i) => {
      const name = `_reel-v1-list-${i + 1}.png`;
      fs.writeFileSync(path.join(OUT_DIR, name), buf);
      return name;
    },
  );

  const outro = files.find((f) => f === "outro.png");
  const reelFiles = [cover, ...listFiles, ...(outro ? [outro] : [])];
  const durations = reelFiles.map((f) =>
    f === cover ? COVER_DUR : f === outro ? OUTRO_DUR : LIST_DUR,
  );

  const n = reelFiles.length;
  const videoLen = durations.reduce((a, d) => a + d, 0) - (n - 1) * XFADE;

  const scaleFilter =
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
    `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30`;

  const scaled = reelFiles.map((_, i) => `[${i}:v]${scaleFilter}[v${i}]`);

  // 컷 길이가 서로 달라 offset 을 누적으로 잡는다(종전엔 전부 2.5초라 i 배수였다).
  const transitions: string[] = [];
  let prev = "v0";
  let accum = durations[0];
  for (let i = 1; i < n; i++) {
    const offset = accum - XFADE;
    const out = i === n - 1 ? "vout" : `vx${i}`;
    transitions.push(
      `[${prev}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${out}]`,
    );
    prev = out;
    accum = accum - XFADE + durations[i];
  }
  // 컷이 하나뿐이면 xfade 가 없다 — 그 스트림을 그대로 출력으로 쓴다.
  if (n === 1) transitions.push(`[v0]null[vout]`);
  const filterComplex = [...scaled, ...transitions].join(";");

  const fadeStart = Math.max(videoLen - 1, 0);

  const cmd = [
    "ffmpeg -y -hide_banner -loglevel error",
    ...reelFiles.map((f, i) => `-loop 1 -t ${durations[i]} -i "${f}"`),
    `-i "${bgmPath}"`,
    `-filter_complex "${filterComplex}"`,
    `-map "[vout]" -map ${n}:a`,
    "-c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.0",
    "-c:a aac -b:a 128k",
    `-af "afade=t=out:st=${fadeStart.toFixed(3)}:d=1"`,
    `-t ${videoLen.toFixed(3)}`,
    "-movflags +faststart",
    `"${OUTPUT}"`,
  ].join(" ");

  console.log(`🎬 릴스 생성 중... (${n}컷: 커버 + 목록 ${listFiles.length}장 + 아웃트로, 전환 ${XFADE}s, BGM 포함)`);
  console.log(`   영상 길이: ${videoLen.toFixed(1)}s`);
  execSync(cmd, { stdio: "inherit", cwd: OUT_DIR });

  const stat = fs.statSync(path.join(OUT_DIR, OUTPUT));
  console.log(`✅ ${OUTPUT} 생성 완료 (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  patchManifest({ reel: OUTPUT });
}

main();

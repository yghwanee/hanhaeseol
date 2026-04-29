import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { OUT_DIR, patchManifest, readManifest } from "@/lib/manifest";

const DURATION = 2.5;      // 카드 1장 노출 시간(초)
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
  const reelFiles = files.map((f, i) => {
    if (i !== 0) return f;
    const reelVariant = f.replace(/^main-/, "main-reel-");
    return fs.existsSync(path.join(OUT_DIR, reelVariant)) ? reelVariant : f;
  });

  const n = reelFiles.length;
  const videoLen = n * DURATION - (n - 1) * XFADE;

  const scaleFilter =
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
    `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30`;

  const scaled = reelFiles.map((_, i) => `[${i}:v]${scaleFilter}[v${i}]`);

  const transitions: string[] = [];
  let prev = "v0";
  for (let i = 1; i < n; i++) {
    const offset = i * (DURATION - XFADE);
    const out = i === n - 1 ? "vout" : `vx${i}`;
    transitions.push(
      `[${prev}][v${i}]xfade=transition=fade:duration=${XFADE}:offset=${offset.toFixed(3)}[${out}]`,
    );
    prev = out;
  }
  const filterComplex = [...scaled, ...transitions].join(";");

  const fadeStart = Math.max(videoLen - 1, 0);

  const cmd = [
    "ffmpeg -y -hide_banner -loglevel error",
    ...reelFiles.map((f) => `-loop 1 -t ${DURATION} -i "${f}"`),
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

  console.log(`🎬 릴스 생성 중... (${n}장 × ${DURATION}s, 전환 ${XFADE}s, BGM 포함)`);
  console.log(`   영상 길이: ${videoLen.toFixed(1)}s`);
  execSync(cmd, { stdio: "inherit", cwd: OUT_DIR });

  const stat = fs.statSync(path.join(OUT_DIR, OUTPUT));
  console.log(`✅ ${OUTPUT} 생성 완료 (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  patchManifest({ reel: OUTPUT });
}

main();

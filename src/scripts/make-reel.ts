import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const DURATION = 2.5;      // 카드 1장 노출 시간(초)
const XFADE = 0.6;         // 크로스페이드 길이(초)
const WIDTH = 1080;
const HEIGHT = 1920;
const OUTPUT = "reel.mp4";
const BGM_REL = "assets/bgm.mp3";

function main() {
  const outDir = path.resolve("generated/instagram");
  const manifestPath = path.join(outDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("manifest.json 없음 — 먼저 post:all 실행 필요");

  const { files } = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { files: string[] };
  if (files.length === 0) throw new Error("카드 없음");

  const bgmPath = path.resolve(BGM_REL);
  if (!fs.existsSync(bgmPath)) throw new Error(`BGM 없음: ${bgmPath}`);

  const n = files.length;
  const videoLen = n * DURATION - (n - 1) * XFADE;

  // 각 이미지 스케일/패딩
  const scaleFilter =
    `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,` +
    `pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30`;

  const scaled = files.map((_, i) => `[${i}:v]${scaleFilter}[v${i}]`);

  // xfade 체인
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
    ...files.map((f) => `-loop 1 -t ${DURATION} -i "${f}"`),
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
  execSync(cmd, { stdio: "inherit", cwd: outDir });

  const stat = fs.statSync(path.join(outDir, OUTPUT));
  console.log(`✅ ${OUTPUT} 생성 완료 (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.reel = OUTPUT;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

main();

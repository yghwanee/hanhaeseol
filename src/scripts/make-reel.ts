import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const SECONDS_PER_CARD = 2.5;
const WIDTH = 1080;
const HEIGHT = 1920;
const OUTPUT = "reel.mp4";
const LIST = "reel-list.txt";

function main() {
  const outDir = path.resolve("generated/instagram");
  const manifestPath = path.join(outDir, "manifest.json");
  if (!fs.existsSync(manifestPath)) throw new Error("manifest.json 없음 — 먼저 post:all 실행 필요");

  const { files } = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as { files: string[] };
  if (files.length === 0) throw new Error("카드 없음");

  // concat demuxer 포맷: 각 파일 뒤에 duration, 마지막 파일은 한 번 더 명시
  const lines: string[] = [];
  for (const f of files) {
    lines.push(`file '${f}'`);
    lines.push(`duration ${SECONDS_PER_CARD}`);
  }
  lines.push(`file '${files[files.length - 1]}'`);
  fs.writeFileSync(path.join(outDir, LIST), lines.join("\n"));

  const vf = `scale=${WIDTH}:${HEIGHT}:force_original_aspect_ratio=decrease,pad=${WIDTH}:${HEIGHT}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30`;

  const cmd = [
    "ffmpeg -y -hide_banner -loglevel error",
    `-f concat -safe 0 -i "${LIST}"`,
    `-f lavfi -i "anullsrc=r=44100:cl=stereo"`,
    `-vf "${vf}"`,
    "-c:v libx264 -pix_fmt yuv420p -profile:v high -level 4.0",
    "-c:a aac -b:a 128k -shortest",
    "-movflags +faststart",
    `"${OUTPUT}"`,
  ].join(" ");

  console.log(`🎬 릴스 생성 중... (${files.length}장 × ${SECONDS_PER_CARD}s)`);
  execSync(cmd, { stdio: "inherit", cwd: outDir });

  const stat = fs.statSync(path.join(outDir, OUTPUT));
  console.log(`✅ ${OUTPUT} 생성 완료 (${(stat.size / 1024 / 1024).toFixed(2)} MB)`);

  // 매니페스트에 릴스 파일명 추가
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  manifest.reel = OUTPUT;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
}

main();

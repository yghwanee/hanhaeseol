import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import { OUT_DIR, patchManifest, readManifest } from "@/lib/manifest";
import { renderReelTitleCard } from "@/lib/reel-title-card";
import { renderReelBigMatchCard } from "@/lib/reel-bigmatch-card";
import { renderCtaOverlay } from "@/lib/reel-overlay";
import { pickHookImage } from "@/lib/hook-card";
import { registerFonts, getKstToday } from "@/lib/instagram";

const W = 1080;
const H = 1920;
const FPS = 30;
const XFADE = 0.3;

const TITLE_DUR = 4.0;
const BIGMATCH_DUR = 3.5;
const SPORT_DUR = 1.8;
const OUTRO_DUR = 3.5;

const TITLE_PUNCH_D = 0.7;   // 영상 시작 zoomin 펀치 길이
const TITLE_PUNCH_Z = 0.10;  // 펀치 줌 폭 (1.10 → 1.0) — 첫 프레임 자막 잘림 최소화

const CTA_FADE_IN_ST = 0.4;
const CTA_FADE_IN_D = 0.8;

const OUTPUT = "reel-v2.mp4";

async function main() {
  registerFonts();
  const { today } = getKstToday();

  const { files } = readManifest();
  if (files.length === 0) throw new Error("매니페스트에 카드 없음");

  // title 카드 (영상 첫 프레임) — 9:16. 자막 박혀 있어야 썸네일 흰색 회피.
  const hookImg = pickHookImage(today);
  const titleFile = "_reel-title.png";
  const titleBuf = await renderReelTitleCard(hookImg, today, "9:16");
  fs.writeFileSync(path.join(OUT_DIR, titleFile), titleBuf);

  // 인스타 REELS cover_url + 피드 캐러셀 1번 슬라이드 공용 — 4:5 (1080x1350).
  // post-instagram-all.ts가 main-MMDD.png를 동일 디자인 4:5로 만들지만,
  // 여기서 cover 전용으로 한 번 더 저장하지 않고 그 main-MMDD.png를 그대로 cover로 사용.
  // (insta-media 브랜치 push 시 main-MMDD.png 가 같이 올라가므로 CDN URL 사용 가능.)
  const mmddForCover = today.slice(5).replace("-", "");
  const coverFile = `main-${mmddForCover}.png`;
  console.log(`✅ title (9:16, 영상 첫 프레임) — cover는 캐러셀 1번(${coverFile})과 공용`);

  // bigmatch 카드 (있으면)
  const bigmatch = await renderReelBigMatchCard(today);
  let bigmatchFile: string | null = null;
  if (bigmatch) {
    bigmatchFile = "_reel-bigmatch.png";
    fs.writeFileSync(path.join(OUT_DIR, bigmatchFile), bigmatch.buf);
    const matchup = bigmatch.hero.awayTeam
      ? `${bigmatch.hero.homeTeam} vs ${bigmatch.hero.awayTeam}`
      : bigmatch.hero.homeTeam;
    console.log(`✅ 빅매치: ${matchup} (${bigmatch.hero.time})`);
  } else {
    console.log(`📭 빅매치 없음 — 컷 스킵`);
  }

  // CTA overlay
  const ctaFile = "_cta-overlay.png";
  fs.writeFileSync(path.join(OUT_DIR, ctaFile), renderCtaOverlay());

  // 스포츠/outro
  const sportFiles = files.filter(
    (f) => !f.startsWith("main-") && f !== "outro.png",
  );
  const outroFile = files.find((f) => f === "outro.png");
  if (!outroFile) throw new Error("outro.png 없음 — npm run post:all 먼저");

  // 영상 컷 구성: title → bigmatch? → sports → outro
  const baseFiles: string[] = [titleFile];
  if (bigmatchFile) baseFiles.push(bigmatchFile);
  baseFiles.push(...sportFiles);
  baseFiles.push(outroFile);

  const durations = baseFiles.map((f, i) => {
    if (i === 0) return TITLE_DUR;
    if (f === bigmatchFile) return BIGMATCH_DUR;
    if (f === outroFile) return OUTRO_DUR;
    return SPORT_DUR;
  });

  let total =
    durations.reduce((s, d) => s + d, 0) - (baseFiles.length - 1) * XFADE;

  const bgmPath = path.resolve("assets/bgm.mp3");
  if (!fs.existsSync(bgmPath)) throw new Error(`BGM 없음: ${bgmPath}`);

  const inputArgs: string[] = [];
  baseFiles.forEach((f, i) => {
    inputArgs.push(`-loop 1 -framerate ${FPS} -t ${durations[i]} -i "${f}"`);
  });

  const ctaIdx = baseFiles.length;
  const bgmIdx = baseFiles.length + 1;
  inputArgs.push(`-loop 1 -framerate ${FPS} -t ${total} -i "${ctaFile}"`);
  inputArgs.push(`-i "${bgmPath}"`);

  // 다른 컷용 1x scale (정적)
  const scaleAndPad =
    `scale=${W}:${H}:force_original_aspect_ratio=decrease:flags=lanczos,` +
    `pad=${W}:${H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=${FPS}`;

  // title 컷용 4x scale + zoompan punch — 입력을 4배(4320x7680)로 키워서
  // zoompan이 매 프레임 자를 영역의 픽셀 정수화 오차를 시각적으로 거의 0으로 만듦.
  const SCALE_W = W * 4;
  const SCALE_H = H * 4;
  const scaleAndPadXL =
    `scale=${SCALE_W}:${SCALE_H}:force_original_aspect_ratio=decrease:flags=lanczos,` +
    `pad=${SCALE_W}:${SCALE_H}:(ow-iw)/2:(oh-ih)/2:black,setsar=1`;

  const filters: string[] = [];
  const lastIdx = baseFiles.length - 1;

  baseFiles.forEach((f, i) => {
    if (i === 0) {
      // title: 0.7초 사인 곡선 펀치 (1.0 → 1.10 → 1.0).
      // 첫 프레임 z=1.0이 보장돼 mp4 첫 frame = 깨끗한 title 카드 = 썸네일 정상.
      const frames = Math.round(durations[i] * FPS);
      const punchFrames = Math.round(TITLE_PUNCH_D * FPS);
      const zoom =
        `zoompan=z='if(lt(on,${punchFrames}),` +
        `1+${TITLE_PUNCH_Z.toFixed(2)}*sin(PI*on/${punchFrames}),1.0)':` +
        `x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':` +
        `d=${frames}:s=${W}x${H}:fps=${FPS}`;
      filters.push(`[${i}:v]${scaleAndPadXL},${zoom}[bg${i}]`);
    } else {
      // 다른 컷은 정적
      filters.push(`[${i}:v]${scaleAndPad}[bg${i}]`);
    }
  });

  // title은 합본이라 텍스트 overlay 불필요 — 그냥 alias
  filters.push(`[bg0]null[v0]`);

  // 중간 컷들 alias
  for (let i = 1; i < lastIdx; i++) {
    filters.push(`[bg${i}]null[v${i}]`);
  }

  // outro 위 CTA 자막 페이드인
  filters.push(
    `[${ctaIdx}:v]format=rgba,` +
      `fade=t=in:st=${CTA_FADE_IN_ST}:d=${CTA_FADE_IN_D}:alpha=1[ctatxt]`,
  );
  filters.push(
    `[bg${lastIdx}][ctatxt]overlay=0:0:enable='gte(t,${CTA_FADE_IN_ST})'[v${lastIdx}]`,
  );

  // xfade chain — 컷 전환에 트렌디 효과
  //  - title → bigmatch: zoomin (다음 화면 줌인 등장)
  //  - bigmatch → sport1: smoothleft (방향감)
  //  - sport 간: fade (단순)
  //  - 마지막 sport → outro: zoomin (CTA 강조)
  const pickTransition = (i: number): string => {
    if (i === 1) return "zoomin";
    if (i === 2 && bigmatchFile) return "smoothleft";
    if (i === lastIdx) return "zoomin";
    return "fade";
  };
  const pickXfadeDur = (transition: string) =>
    transition === "zoomin" ? 0.7 : XFADE;

  let prevStream = "v0";
  let accum = durations[0];
  for (let i = 1; i < baseFiles.length; i++) {
    const transition = pickTransition(i);
    const xfd = pickXfadeDur(transition);
    const offset = accum - xfd;
    const out = i === lastIdx ? "vfin" : `vx${i}`;
    filters.push(
      `[${prevStream}][v${i}]xfade=transition=${transition}:duration=${xfd}:offset=${offset.toFixed(3)}[${out}]`,
    );
    prevStream = out;
    accum = accum - xfd + durations[i];
  }
  total = accum;

  console.log(
    `📐 영상 길이: ${total.toFixed(1)}s (${baseFiles.length}컷, title punch ${TITLE_PUNCH_D}s)`,
  );

  // 최종 fade out
  const fadeOutStart = Math.max(total - 0.8, 0);
  filters.push(`[vfin]fade=t=out:st=${fadeOutStart}:d=0.8[vout]`);
  filters.push(
    `[${bgmIdx}:a]afade=t=in:st=0:d=0.4,` +
      `afade=t=out:st=${fadeOutStart}:d=0.8[aout]`,
  );

  const filterScriptFile = "_filter.txt";
  fs.writeFileSync(path.join(OUT_DIR, filterScriptFile), filters.join(";\n"));

  // 1단계: 메인 영상 인코딩 (고품질로 stutter 회피)
  //   - CRF 18: 시각적 무손실 근접
  //   - maxrate 7M + bufsize 14M: 모션 많은 구간(xfade zoomin, punch)도 비트 충분히
  //   - keyint 60: 2초마다 keyframe — seek/플랫폼 호환성
  //   - fps_mode cfr -r 30: 출력 고정 framerate
  const TEMP_OUT = "_temp-reel.mp4";
  const cmd1 = [
    "ffmpeg -y -hide_banner -loglevel error",
    ...inputArgs,
    `-filter_complex_script "${filterScriptFile}"`,
    `-map "[vout]" -map "[aout]"`,
    `-t ${total.toFixed(3)}`,
    "-c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p",
    "-preset medium -crf 18",
    "-maxrate 7M -bufsize 14M",
    "-g 60 -keyint_min 60",
    // -vsync cfr: ffmpeg 4.x/5.x/6.x 모두 호환 (5.x+에선 deprecated지만 작동).
    // -fps_mode cfr (5.1+)는 4.x에서 인식 불가라 GH Actions ubuntu-22.04 환경에서 위험.
    `-r ${FPS} -vsync cfr`,
    "-c:a aac -b:a 192k",
    "-movflags +faststart",
    `"${TEMP_OUT}"`,
  ].join(" ");

  console.log(`🎬 1/2 메인 영상 인코딩 중... (CRF 18, maxrate 7M, CFR)`);
  execSync(cmd1, { stdio: "inherit", cwd: OUT_DIR });

  // 2단계: mp4에 cover image attached_pic 첨부
  //   - 일부 player/탐색기가 영상 stream의 첫 frame이 아니라 attached_pic을 썸네일로 인식
  //   - 인스타/유튜브는 별도 cover_url 사용해야 하나, 이건 게시 측 작업
  const cmd2 = [
    "ffmpeg -y -hide_banner -loglevel error",
    `-i "${TEMP_OUT}"`,
    `-i "${titleFile}"`,
    "-map 0 -map 1:v",
    "-c copy",
    "-c:v:1 mjpeg",
    "-disposition:v:1 attached_pic",
    `-metadata:s:v:1 title="Cover"`,
    "-movflags +faststart",
    `"${OUTPUT}"`,
  ].join(" ");

  console.log(`🎬 2/2 cover image attached_pic 첨부 중...`);
  execSync(cmd2, { stdio: "inherit", cwd: OUT_DIR });

  // temp 파일 삭제
  try {
    fs.unlinkSync(path.join(OUT_DIR, TEMP_OUT));
  } catch {}

  const stat = fs.statSync(path.join(OUT_DIR, OUTPUT));
  console.log(
    `✅ ${OUTPUT} 생성 완료 (${(stat.size / 1024 / 1024).toFixed(2)} MB, ${total.toFixed(1)}s)`,
  );

  patchManifest({ reel: OUTPUT, cover: coverFile });
}

main().catch((e) => {
  console.error("❌", e);
  process.exit(1);
});

// src/scripts/social-v3.ts
//
// 소셜 v3 (2026-10-06 확정 디자인) 미디어 생성. 기존 manifest 계약을 그대로 채운다 —
// 게시 스크립트(post:ig·post:reel·post:story·post:youtube·post:tiktok)는 손대지 않는다.
//
//   files       캐러셀 = 각 장의 4:5 띠(1080x1350)
//   cover       9:16 히어로 정지 화면 — 릴스 cover_url · 유튜브 쇼츠 썸네일
//   story       같은 9:16 히어로
//   reel        움직이는 9:16 영상(카메라가 공을 따라 한 장씩 넘긴다)
//   reelTiktok  사진 없는 판(AI 사진 미사용 · URL 없음)
//
// 🔴 썸네일 규칙: 글자·카드는 전부 9:16 안의 4:5 띠(y 285~1635)와 좌우 110 여백 안에 있다.
// 인스타 피드(4:5)·프로필 그리드(3:4)·쇼츠 썸네일·쇼츠 오른쪽 버튼 줄이 그 밖만 자른다.
// 종전엔 쇼츠 썸네일을 4:5 캐러셀 1장으로 설정해 쇼츠가 그 가운데를 잘라 보여 줬다.

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { execSync } from "node:child_process";
import { chromium, type Page } from "playwright";
import { OUT_DIR, writeManifest } from "@/lib/manifest";
import { getKstToday } from "@/lib/instagram";
import { getPostSlot } from "@/lib/post-slot";
import { pickHookImage } from "@/lib/hook-card";
import { buildV3Data, type V3Data } from "@/lib/social-v3";

const FPS = 30;
const W = 1080;
const H = 1920;
const TEMPLATE = path.resolve("templates/social-v3/render.html");
const LOGO = path.resolve("assets/logo.png");
const BGM = path.resolve("assets/bgm.mp3");
const ONLY_STILLS = process.argv.includes("--stills");

const fileUrl = (p: string) => pathToFileURL(p).href;

async function bootPage(page: Page, data: V3Data): Promise<{ slides: number; totalMs: number }> {
  await page.goto(fileUrl(TEMPLATE));
  await page.evaluate(() => document.fonts.ready);
  const info = await page.evaluate((d) => (window as unknown as { boot: (x: unknown) => { slides: number; totalMs: number } }).boot(d), data);
  // 사진·로고 디코드 대기 (첫 프레임이 빈 사진으로 찍히지 않게)
  await page.evaluate(async () => {
    const imgs = [...document.querySelectorAll("image")].map((el) => el.getAttribute("href")).filter((h): h is string => !!h);
    await Promise.all([...new Set(imgs)].map((src) => new Promise((res) => { const im = new Image(); im.onload = im.onerror = () => res(null); im.src = src; })));
  });
  await page.waitForTimeout(300);
  return info;
}

async function renderVideo(page: Page, totalMs: number, outName: string, tag: string) {
  const frameDir = path.join(OUT_DIR, `_v3-frames${tag}`);
  fs.rmSync(frameDir, { recursive: true, force: true });
  fs.mkdirSync(frameDir, { recursive: true });
  const frames = Math.ceil((totalMs / 1000) * FPS);
  const t0 = Date.now();
  for (let f = 0; f < frames; f++) {
    await page.evaluate((ms) => (window as unknown as { frame: (m: number) => void }).frame(ms), (f * 1000) / FPS);
    await page.screenshot({ path: path.join(frameDir, `f${String(f).padStart(4, "0")}.jpg`), type: "jpeg", quality: 92 });
  }
  console.log(`🎞️  프레임 ${frames}장 캡처 (${((Date.now() - t0) / 1000).toFixed(0)}초)`);

  const dur = (frames / FPS).toFixed(3);
  const fadeAt = Math.max(0, frames / FPS - 0.8).toFixed(3);
  const cmd = [
    "ffmpeg -y -hide_banner -loglevel error",
    `-framerate ${FPS} -i "${path.join(frameDir, "f%04d.jpg")}"`,
    `-i "${BGM}"`,
    `-filter_complex "[1:a]afade=t=in:st=0:d=0.4,afade=t=out:st=${fadeAt}:d=0.8[a]"`,
    `-map 0:v -map "[a]" -t ${dur}`,
    "-c:v libx264 -profile:v high -level 4.0 -pix_fmt yuv420p -preset medium -crf 18 -maxrate 7M -bufsize 14M -g 60 -keyint_min 60",
    `-r ${FPS} -vsync cfr -c:a aac -b:a 192k -movflags +faststart`,
    `"${path.join(OUT_DIR, outName)}"`,
  ].join(" ");
  execSync(cmd, { stdio: "inherit" });
  fs.rmSync(frameDir, { recursive: true, force: true });
  const mb = fs.statSync(path.join(OUT_DIR, outName)).size / 1024 / 1024;
  console.log(`✅ ${outName} (${mb.toFixed(2)} MB, ${dur}s)`);
}

async function main() {
  const { today, mm, dd } = getKstToday();
  const slot = getPostSlot(today);
  fs.mkdirSync(OUT_DIR, { recursive: true });
  // 이전 v3 산출물만 지운다 (post-report.json 등 같은 폴더의 다른 파일은 건드리지 않는다)
  for (const f of fs.readdirSync(OUT_DIR)) {
    if (/^(v3-|reel-v3|_v3-)/.test(f)) fs.rmSync(path.join(OUT_DIR, f), { recursive: true, force: true });
  }

  const photoPath = pickHookImage(today, slot);
  const data = buildV3Data(today, slot, { photo: fileUrl(photoPath), logo: fileUrl(LOGO) });
  fs.writeFileSync(path.join(OUT_DIR, "_v3-data.json"), JSON.stringify(data, null, 2));
  console.log(`🎯 ${today} ${slot} · 사진 ${path.basename(photoPath)} · ${data.slides.length}장 · 히어로 ${data.hero.home} vs ${data.hero.away}`);

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const { slides, totalMs } = await bootPage(page, data);
    const band = await page.evaluate(() => (window as unknown as { BAND: { top: number; height: number } }).BAND);

    // 정지 화면: 히어로 9:16 (커버·스토리·쇼츠 썸네일) + 장마다 4:5 띠 (캐러셀)
    const cover = `v3-cover-${mm}${dd}.png`;
    await page.evaluate((i) => (window as unknown as { still: (n: number) => void }).still(i), 0);
    await page.screenshot({ path: path.join(OUT_DIR, cover) });
    const files: string[] = [];
    for (let i = 0; i < slides; i++) {
      await page.evaluate((n) => (window as unknown as { still: (n: number) => void }).still(n), i);
      const name = `v3-${mm}${dd}-${i + 1}.png`;
      await page.screenshot({ path: path.join(OUT_DIR, name), clip: { x: 0, y: band.top, width: W, height: band.height } });
      files.push(name);
    }
    console.log(`✅ 정지 화면: 커버 1 + 캐러셀 ${files.length}장 (4:5)`);

    writeManifest({ date: `${mm}${dd}`, files, cover, story: cover });
    if (ONLY_STILLS) return;

    await renderVideo(page, totalMs, "reel-v3.mp4", "");

    // 틱톡판: AI 사진을 쓰지 않는다(2026-09-01 결정) · URL 없음
    const tt = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
    const ttData: V3Data = { ...data, photo: null, noUrl: true };
    const ttInfo = await bootPage(tt, ttData);
    await renderVideo(tt, ttInfo.totalMs, "reel-v3-tiktok.mp4", "-tt");

    writeManifest({
      date: `${mm}${dd}`,
      files,
      cover,
      story: cover,
      reel: "reel-v3.mp4",
      reelTiktok: "reel-v3-tiktok.mp4",
      reelTiktokAigc: false,
    });
    console.log("✅ manifest 작성 (v3)");
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error("❌ social-v3 실패:", e);
  process.exit(1);
});

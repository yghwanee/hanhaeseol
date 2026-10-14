// src/scripts/yt-shorts-thumb-fix.ts
//
// 유튜브 쇼츠 세로 썸네일을 우리 커버(= 영상 첫 화면)로 **자동으로** 고친다. 이 PC 에서만 돈다.
//
// 왜 PC 인가: 세로 쇼츠 썸네일은 API 로 못 바꾼다(src/lib/shorts-thumb.ts). Studio 데스크톱 화면의
// 「파일 업로드」만 된다 → 유튜브에 로그인된 브라우저가 있어야 하고, 그게 이 PC 의 Aside 브라우저다.
// 화니가 매 게시마다 손으로 하던 일(2026-10-12 지적)을 그대로 대신한다.
//
// 흐름: insta-media 커버 + main 의 post-log → 가장 최근 슬롯의 쇼츠 ID
//   → 공개 썸네일이 이미 커버면 끝(매시간 돌아도 아무것도 안 한다)
//   → 아니면 `aside repl` 로 Studio 편집 화면을 열어 커버를 올리고 저장 → 공개 썸네일 재확인.
//
// 사용: npx tsx src/scripts/yt-shorts-thumb-fix.ts [--id=<videoId>] [--dry] [--force]
//   --force = 이미 같아도 다시 올린다(경로 점검용, 같은 커버라 결과는 그대로)
//   종료코드 0 = 이미 같음/고침 · 2 = 고치려 했는데 실패 · 1 = 스크립트 오류
// 작업 스케줄러 래퍼 = tools/yt-shorts-thumb-fix.ps1 (로그 generated/yt-shorts-thumb-fix.log)

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { mediaBaseUrl } from "@/lib/instagram-api";
import { checkShortsThumb, fetchBuf, jpegTwin, latestSlot, type Manifest, type PostLog } from "@/lib/shorts-thumb";

const POST_LOG_URL = "https://raw.githubusercontent.com/yghwanee/hanhaeseol/main/data/post-log.json";
const arg = (k: string) => process.argv.find((a) => a.startsWith(`--${k}=`))?.split("=")[1];
const DRY = process.argv.includes("--dry");
const FORCE = process.argv.includes("--force");

function asideBin(): string {
  const local = path.join(process.env.LOCALAPPDATA ?? "", "Aside", "CLI", "current", "aside.exe");
  return fs.existsSync(local) ? local : "aside";
}

/**
 * Studio 편집 화면에서 커버를 업로드하고 저장한다. aside repl 안에서 도는 코드다.
 * 🔴 aside repl 에는 page.waitForTimeout 이 없고, setInputFiles 는 세션 폴더 밖 경로를 거부한다
 * → 이미지는 페이지 안에서 raw URL 로 받아 DataTransfer 로 file input 에 꽂는다(2026-10-14 실측).
 */
function studioUploadCode(videoId: string, coverUrl: string): string {
  return `
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var tab = await openTab(${JSON.stringify(`https://studio.youtube.com/video/${videoId}/edit`)});
var p = tab || page;
var ready = false;
for (var i = 0; i < 30 && !ready; i++) {
  await sleep(1000);
  ready = await p.evaluate(() => !!document.querySelector('ytcp-video-thumbnail-editor input[type=file]'));
}
if (!ready) {
  var where = await p.evaluate(() => location.href);
  console.log('RESULT:fail 썸네일 편집기를 못 찾음 (로그인 풀림?) ' + where);
} else {
  var up = await p.evaluate(async (url) => {
    const res = await fetch(url);
    if (!res.ok) return 'fetch ' + res.status;
    const blob = await res.blob();
    const inp = document.querySelector('ytcp-video-thumbnail-editor input[type=file]');
    const dt = new DataTransfer();
    dt.items.add(new File([blob], url.split('/').pop(), { type: 'image/jpeg' }));
    inp.files = dt.files;
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    return 'ok';
  }, ${JSON.stringify(coverUrl)});
  if (up !== 'ok') {
    console.log('RESULT:fail 커버 받기 실패 ' + up);
  } else {
    var canSave = false;
    for (var j = 0; j < 30 && !canSave; j++) {
      await sleep(1000);
      canSave = await p.evaluate(() => document.querySelector('#save')?.getAttribute('aria-disabled') === 'false');
    }
    var err = await p.evaluate(() => (document.querySelector('ytcp-video-thumbnail-editor ytcp-form-error-tip')?.innerText || '').trim());
    if (!canSave) {
      console.log('RESULT:fail 저장 버튼이 안 켜짐 ' + err);
    } else {
      await p.evaluate(() => document.querySelector('#save').click());
      var saved = false;
      for (var k = 0; k < 30 && !saved; k++) {
        await sleep(1000);
        saved = await p.evaluate(() => document.querySelector('#save')?.getAttribute('aria-disabled') === 'true');
      }
      console.log(saved ? 'RESULT:ok' : 'RESULT:fail 저장 후 확인 안 됨');
    }
  }
}
try { await p.close(); } catch (e) {}
`;
}

async function main() {
  const base = mediaBaseUrl();
  const manifest = (await (await fetch(`${base}/manifest.json`)).json()) as Manifest;
  if (!manifest.cover) throw new Error("manifest.cover 없음 — v3 이전 산출물");
  const coverUrl = `${base}/${jpegTwin(manifest.cover, manifest)}`;
  const cover = await fetchBuf(coverUrl);
  if (!cover) throw new Error(`커버를 못 받음: ${coverUrl}`);

  let ytId = arg("id");
  if (!ytId) {
    // 로컬 체크아웃은 늙었을 수 있다 — 게시 기록은 원격 main 에서 읽는다
    const log = (await (await fetch(`${POST_LOG_URL}?t=${Date.now()}`)).json()) as PostLog;
    const slot = latestSlot(log, manifest);
    if (!slot) {
      console.log(`⏳ ${manifest.date} 슬롯 게시 기록 없음 — 아직 안 올라갔다`);
      return;
    }
    ytId = log.posted[`${slot}|youtube`]?.detail.split("/").pop();
    if (!ytId) {
      console.log(`⏳ ${slot} 유튜브 게시 기록 없음`);
      return;
    }
    console.log(`🎯 ${slot} · ${ytId} · 커버 ${manifest.cover}`);
  }

  const before = await checkShortsThumb(ytId, cover);
  if (before.status === "같음" && !FORCE) {
    console.log(`✅ 이미 커버와 같음 (${before.source} 차이 ${before.diff.toFixed(1)})`);
    return;
  }
  console.log(`🔧 고칠 대상: ${before.status === "미반영" ? "자동 프레임 노출 중" : `${before.source} 차이 ${before.diff.toFixed(1)}`}${FORCE ? " (--force)" : ""}`);
  if (DRY) return;

  let out = "";
  try {
    out = execFileSync(asideBin(), ["repl", studioUploadCode(ytId, coverUrl)], { encoding: "utf8", timeout: 150_000 });
  } catch (e) {
    const err = e as { stdout?: string; stderr?: string; message: string };
    out = `${err.stdout ?? ""}\n${err.stderr ?? ""}\n${err.message}`;
  }
  const result = out.split("\n").find((l) => l.includes("RESULT:"))?.trim();
  if (!result?.includes("RESULT:ok")) {
    console.error(`❌ Studio 교정 실패: ${result ?? out.trim().split("\n").slice(-3).join(" / ")}`);
    if (/isn't running|not running/i.test(out)) console.error("   → Aside 브라우저가 꺼져 있다");
    process.exitCode = 2;
    return;
  }

  // 공개 썸네일 반영은 수 초~수십 초 걸린다(2026-10-14 실측 20초 안)
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 10_000));
    const after = await checkShortsThumb(ytId, cover);
    if (after.status === "같음") {
      console.log(`✅ 고침 (${after.source} 차이 ${after.diff.toFixed(1)})`);
      return;
    }
  }
  console.error("❌ Studio 저장은 됐는데 2분 안에 공개 썸네일이 안 바뀜");
  process.exitCode = 2;
}

main().catch((e) => {
  console.error("❌ 쇼츠 썸네일 교정 오류:", e);
  process.exit(1);
});

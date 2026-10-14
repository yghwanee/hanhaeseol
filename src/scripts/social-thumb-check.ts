// src/scripts/social-thumb-check.ts
//
// 게시된 썸네일이 우리 커버(= 영상 첫 프레임)와 같은지 **플랫폼에 실제로 걸린 이미지**로 확인한다.
// 2026-10-12 화니 지적: "썸네일과 컨텐츠 첫 이미지가 다르다, 하나하나 손으로 바꾸고 있다".
// 파일은 맞았다(커버 vs reel-v3.mp4 첫 프레임 평균 차 1.6/255 = JPEG 노이즈). 그래서 플랫폼 쪽을 본다.
//
//   유튜브 쇼츠  공개로 나가는 세로 썸네일(sardefault = Studio 업로드 / oardefault = Studio 프레임 선택).
//               둘 다 없으면 유튜브가 고른 자동 프레임(oar2)이 나가는 중이다. API(thumbnails.set)로는 못 바꾼다
//               — 판정 규칙과 근거는 src/lib/shorts-thumb.ts. 이 PC 의 작업 스케줄러가 매시간
//               tools/yt-shorts-thumb-fix.ps1 로 Studio 에 커버를 올려 고친다(2026-10-14, 작업131).
//               여기서 「미반영」이 뜨면 그 자동 교정이 안 돈 것이다(PC 꺼짐·Aside 꺼짐·로그인 풀림).
//   인스타 릴스  Graph `thumbnail_url`
//   인스타 캐러셀 첫 장 Graph children[0].media_url ↔ files[0]
//   틱톡        Display API 심사 전이라 못 본다 → 첫 프레임이 커버가 되는 게 API 기본값(문서 확인)이라 생략.
//
// 기준 이미지는 insta-media 브랜치(가장 최근 슬롯 산출물)라 **가장 최근 슬롯만** 비교한다.
// 사용: npx tsx src/scripts/social-thumb-check.ts   (IG_* 시크릿 필요, 없으면 인스타는 건너뜀)

import fs from "node:fs";
import path from "node:path";
import { mediaBaseUrl } from "@/lib/instagram-api";
import { SAME_THRESHOLD, checkShortsThumb, fetchBuf, imageDiff, jpegTwin, latestSlot, type Manifest, type PostLog } from "@/lib/shorts-thumb";

const IG_API = "https://graph.facebook.com/v21.0";
type Verdict = { channel: string; status: "같음" | "다름" | "미반영" | "확인불가"; detail: string };

async function main() {
  const base = mediaBaseUrl();
  const manifest = (await (await fetch(`${base}/manifest.json`)).json()) as Manifest;
  if (!manifest.cover) throw new Error("manifest.cover 없음 — v3 이전 산출물");
  const cover = await fetchBuf(`${base}/${jpegTwin(manifest.cover, manifest)}`);
  const first = await fetchBuf(`${base}/${jpegTwin(manifest.files[0], manifest)}`);
  if (!cover || !first) throw new Error("insta-media 에서 기준 이미지를 못 받음");

  const log = JSON.parse(fs.readFileSync(path.resolve("data/post-log.json"), "utf8")) as PostLog;
  const latest = latestSlot(log, manifest);
  if (!latest) throw new Error(`post-log 에 ${manifest.date} 게시 기록 없음`);
  const get = (ch: string) => log.posted[`${latest}|${ch}`]?.detail ?? "";
  console.log(`🎯 대상 슬롯 ${latest} (기준 커버 ${manifest.cover})`);

  const out: Verdict[] = [];

  // 유튜브
  const ytId = get("youtube").split("/").pop();
  if (ytId) {
    const studio = `https://studio.youtube.com/video/${ytId}/edit`;
    const r = await checkShortsThumb(ytId, cover);
    if (r.status === "미반영") {
      out.push({ channel: "유튜브 쇼츠", status: "미반영", detail: `자동 프레임 노출 중 — PC 자동 교정이 안 돌았다(yt-shorts-thumb-fix.log 확인): ${studio}` });
    } else {
      out.push({ channel: "유튜브 쇼츠", status: r.status, detail: `${r.source} 차이 ${r.diff.toFixed(1)} · ${studio}` });
    }
  }

  // 인스타
  const token = process.env.IG_PAGE_ACCESS_TOKEN;
  const mediaId = (ch: string) => get(ch).match(/Media ID (\d+)/)?.[1];
  if (!token) {
    out.push({ channel: "인스타", status: "확인불가", detail: "IG_PAGE_ACCESS_TOKEN 없음" });
  } else {
    const reelId = mediaId("reel");
    if (reelId) {
      const j = (await (await fetch(`${IG_API}/${reelId}?fields=thumbnail_url&access_token=${token}`)).json()) as { thumbnail_url?: string };
      const t = j.thumbnail_url ? await fetchBuf(j.thumbnail_url) : null;
      if (!t) out.push({ channel: "인스타 릴스", status: "확인불가", detail: `${reelId} thumbnail_url 없음` });
      else {
        const d = await imageDiff(t, cover);
        out.push({ channel: "인스타 릴스", status: d <= SAME_THRESHOLD ? "같음" : "다름", detail: `${reelId} 차이 ${d.toFixed(1)}` });
      }
    }
    const carId = mediaId("carousel");
    if (carId) {
      const j = (await (await fetch(`${IG_API}/${carId}/children?fields=media_url&access_token=${token}`)).json()) as { data?: { media_url?: string }[] };
      const u = j.data?.[0]?.media_url;
      const t = u ? await fetchBuf(u) : null;
      if (!t) out.push({ channel: "인스타 캐러셀", status: "확인불가", detail: `${carId} 첫 장 없음` });
      else {
        // 캐러셀은 4:5 띠라 4:5 로 비교
        const d = await imageDiff(t, first, 96, 120);
        out.push({ channel: "인스타 캐러셀 1장", status: d <= SAME_THRESHOLD ? "같음" : "다름", detail: `${carId} 차이 ${d.toFixed(1)}` });
      }
    }
  }

  for (const v of out) console.log(`${v.status === "같음" ? "✅" : v.status === "다름" ? "❌" : "⏳"} ${v.channel}: ${v.status} (${v.detail})`);
  // 게시 1시간 뒤에 돈다 — 그때까지 유튜브 커버가 안 붙었으면(미반영) 그것도 사람이 봐야 한다.
  if (out.some((v) => v.status === "다름" || v.status === "미반영")) process.exitCode = 2;
}

main().catch((e) => {
  console.error("❌ 썸네일 검사 실패:", e);
  process.exit(1);
});

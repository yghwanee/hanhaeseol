// src/scripts/social-thumb-check.ts
//
// 게시된 썸네일이 우리 커버(= 영상 첫 프레임)와 같은지 **플랫폼에 실제로 걸린 이미지**로 확인한다.
// 2026-10-12 화니 지적: "썸네일과 컨텐츠 첫 이미지가 다르다, 하나하나 손으로 바꾸고 있다".
// 파일은 맞았다(커버 vs reel-v3.mp4 첫 프레임 평균 차 1.6/255 = JPEG 노이즈). 그래서 플랫폼 쪽을 본다.
//
//   유튜브 쇼츠  i.ytimg.com/vi/<id>/oardefault.jpg (세로 쇼츠 썸네일). 404 면 아직 커버가 안 붙고
//               유튜브가 자동으로 고른 중간 프레임(oar1~3)이 나가는 중이다.
//   인스타 릴스  Graph `thumbnail_url`
//   인스타 캐러셀 첫 장 Graph children[0].media_url ↔ files[0]
//   틱톡        Display API 심사 전이라 못 본다 → 첫 프레임이 커버가 되는 게 API 기본값(문서 확인)이라 생략.
//
// 기준 이미지는 insta-media 브랜치(가장 최근 슬롯 산출물)라 **가장 최근 슬롯만** 비교한다.
// 사용: npx tsx src/scripts/social-thumb-check.ts   (IG_* 시크릿 필요, 없으면 인스타는 건너뜀)

import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { mediaBaseUrl } from "@/lib/instagram-api";

const IG_API = "https://graph.facebook.com/v21.0";
/** 0~255 평균 절대차. JPEG·리사이즈 노이즈는 3 안팎, 다른 장면이면 20 을 넘는다(2026-10-12 실측). */
export const SAME_THRESHOLD = 12;

type Manifest = { date: string; files: string[]; cover?: string; jpeg?: string[] };
type Verdict = { channel: string; status: "같음" | "다름" | "미반영" | "확인불가"; detail: string };

async function fetchBuf(url: string): Promise<Buffer | null> {
  const res = await fetch(url);
  if (!res.ok) return null;
  return Buffer.from(await res.arrayBuffer());
}

/** 두 이미지를 같은 크기 회색조로 줄여 평균 절대차를 낸다. 비율이 다르면 가운데를 맞춰 자른다(cover). */
export async function imageDiff(a: Buffer, b: Buffer, w = 90, h = 160): Promise<number> {
  const norm = (x: Buffer) => sharp(x).resize(w, h, { fit: "cover" }).greyscale().raw().toBuffer();
  const [pa, pb] = await Promise.all([norm(a), norm(b)]);
  let sum = 0;
  for (let i = 0; i < pa.length; i++) sum += Math.abs(pa[i] - pb[i]);
  return sum / pa.length;
}

function jpegTwin(name: string, m: Manifest): string {
  const j = name.replace(/\.png$/, ".jpg");
  return m.jpeg?.includes(j) ? j : name;
}

async function main() {
  const base = mediaBaseUrl();
  const manifest = (await (await fetch(`${base}/manifest.json`)).json()) as Manifest;
  if (!manifest.cover) throw new Error("manifest.cover 없음 — v3 이전 산출물");
  const cover = await fetchBuf(`${base}/${jpegTwin(manifest.cover, manifest)}`);
  const first = await fetchBuf(`${base}/${jpegTwin(manifest.files[0], manifest)}`);
  if (!cover || !first) throw new Error("insta-media 에서 기준 이미지를 못 받음");

  const log = JSON.parse(fs.readFileSync(path.resolve("data/post-log.json"), "utf8")) as {
    posted: Record<string, { detail: string; at: string }>;
  };
  // insta-media 의 날짜(MMDD)와 맞는 가장 최근 슬롯
  const keys = Object.keys(log.posted).filter((k) => k.slice(5, 10).replace("-", "") === manifest.date);
  const latest = keys.map((k) => k.split("|").slice(0, 2).join("|")).sort((a, b) => (log.posted[`${b}|carousel`]?.at ?? "").localeCompare(log.posted[`${a}|carousel`]?.at ?? ""))[0];
  if (!latest) throw new Error(`post-log 에 ${manifest.date} 게시 기록 없음`);
  const get = (ch: string) => log.posted[`${latest}|${ch}`]?.detail ?? "";
  console.log(`🎯 대상 슬롯 ${latest} (기준 커버 ${manifest.cover})`);

  const out: Verdict[] = [];

  // 유튜브
  const ytId = get("youtube").split("/").pop();
  if (ytId) {
    const thumb = await fetchBuf(`https://i.ytimg.com/vi/${ytId}/oardefault.jpg`);
    if (!thumb) {
      out.push({ channel: "유튜브 쇼츠", status: "미반영", detail: `${ytId} 세로 썸네일 아직 없음 — 유튜브 자동 프레임 노출 중` });
    } else {
      const d = await imageDiff(thumb, cover);
      out.push({ channel: "유튜브 쇼츠", status: d <= SAME_THRESHOLD ? "같음" : "다름", detail: `${ytId} 차이 ${d.toFixed(1)}` });
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

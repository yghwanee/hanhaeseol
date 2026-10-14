// src/lib/shorts-thumb.ts
//
// 유튜브 세로 쇼츠 썸네일 판정 — social-thumb-check(검사·알림)와 yt-shorts-thumb-fix(PC 자동 교정)가 같이 쓴다.
//
// 🔴 2026-10-14 실측(작업131): 쇼츠 공개 페이지가 내보내는 세로 썸네일은
//   - 맞춤 썸네일이 없으면 `oar2.jpg` = 유튜브가 영상 안에서 **내용 보고 고른** 후보 2번.
//     위치가 영상마다 다르다(같은 16.9초 영상에서 6.0초·9.6초). 영상을 손봐서 맞추는 길은 없다.
//   - Studio 데스크톱 「파일 업로드」로 9:16 이미지를 올리면 `sardefault.jpg` 가 생기고 그게 나간다.
//   - `oardefault.jpg` = Studio 「동영상에서 선택」(후보 3장 중 하나)을 고른 경우.
// API `thumbnails.set` 은 가로(maxresdefault)에만 붙는다 → 세로는 Studio 화면으로만 바꿀 수 있다.

import sharp from "sharp";

/** 0~255 평균 절대차. JPEG·리사이즈 노이즈는 3 안팎, 다른 장면이면 20 을 넘는다(2026-10-12 실측). */
export const SAME_THRESHOLD = 12;

export type Manifest = { date: string; files: string[]; cover?: string; jpeg?: string[] };
export type PostLog = { posted: Record<string, { detail: string; at: string }> };

export async function fetchBuf(url: string): Promise<Buffer | null> {
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

export function jpegTwin(name: string, m: Manifest): string {
  const j = name.replace(/\.png$/, ".jpg");
  return m.jpeg?.includes(j) ? j : name;
}

/** insta-media 의 날짜(MMDD)와 맞는 가장 최근 슬롯 키("YYYY-MM-DD|morning"). insta-media 는 가장 최근 산출물만 갖고 있다. */
export function latestSlot(log: PostLog, manifest: Manifest): string | undefined {
  const keys = Object.keys(log.posted).filter((k) => k.slice(5, 10).replace("-", "") === manifest.date);
  return keys
    .map((k) => k.split("|").slice(0, 2).join("|"))
    .sort((a, b) => (log.posted[`${b}|carousel`]?.at ?? "").localeCompare(log.posted[`${a}|carousel`]?.at ?? ""))[0];
}

export type ShortsThumb =
  | { status: "같음" | "다름"; source: "sardefault" | "oardefault"; diff: number }
  | { status: "미반영" };

/** 지금 공개로 나가는 세로 쇼츠 썸네일을 커버와 비교한다. 업로드(sar)가 선택(oar)보다 우선이다. */
export async function checkShortsThumb(ytId: string, cover: Buffer): Promise<ShortsThumb> {
  for (const source of ["sardefault", "oardefault"] as const) {
    // 캐시 우회 — 교정 직후 재확인 때 옛 404 를 받지 않도록
    const thumb = await fetchBuf(`https://i.ytimg.com/vi/${ytId}/${source}.jpg?t=${Date.now()}`);
    if (!thumb) continue;
    const diff = await imageDiff(thumb, cover);
    return { status: diff <= SAME_THRESHOLD ? "같음" : "다름", source, diff };
  }
  return { status: "미반영" };
}

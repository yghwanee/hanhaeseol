import fs from "node:fs";
import path from "node:path";

export type Manifest = {
  date: string;
  files: string[];
  reel?: string;
  /** 틱톡 전용 릴스(URL 워터마크 제거 변형). 없으면 post-tiktok이 reel로 폴백. */
  reelTiktok?: string;
  /**
   * 그 영상에 AI 생성 이미지가 실제로 들어 있는가.
   * 🔴 게시 스크립트는 이 값을 그대로 `is_aigc` 로 보낸다. 필드가 없으면
   * **true 로 본다** — 라벨을 빠뜨리는 쪽이 정책 위반이라 더 나쁘다.
   */
  reelTiktokAigc?: boolean;
  story?: string;
  /** 인스타 REELS API의 cover_url용 9:16 PNG 파일명 (있으면 publishSingleMedia가 사용). */
  cover?: string;
  /**
   * 인스타 업로드용 JPEG 트윈 파일명들 (`npm run ig:jpeg` 가 채운다).
   * 게시 스크립트는 PNG 대신 여기 있는 이름을 올린다 — 이유는 `ig-image.ts` 참조.
   */
  jpeg?: string[];
};

export const OUT_DIR = path.resolve("generated/instagram");
export const MANIFEST_PATH = path.join(OUT_DIR, "manifest.json");

export function readManifest(): Manifest {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error("manifest.json 없음 — 먼저 npm run post:all 실행 필요");
  }
  return JSON.parse(fs.readFileSync(MANIFEST_PATH, "utf8"));
}

export function writeManifest(manifest: Manifest) {
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));
}

export function patchManifest(patch: Partial<Manifest>) {
  writeManifest({ ...readManifest(), ...patch });
}

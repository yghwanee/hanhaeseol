import fs from "node:fs";
import path from "node:path";

export type Manifest = {
  date: string;
  files: string[];
  reel?: string;
  /** 틱톡 전용 릴스(URL 워터마크 제거 변형). 없으면 post-tiktok이 reel로 폴백. */
  reelTiktok?: string;
  story?: string;
  /** 인스타 REELS API의 cover_url용 9:16 PNG 파일명 (있으면 publishSingleMedia가 사용). */
  cover?: string;
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

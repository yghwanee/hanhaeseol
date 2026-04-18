import fs from "node:fs";
import path from "node:path";

export type Manifest = {
  date: string;
  files: string[];
  reel?: string;
  story?: string;
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

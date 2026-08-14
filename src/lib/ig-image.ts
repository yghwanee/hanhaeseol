import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import type { Manifest } from "./manifest";

/**
 * 🔴 인스타에 올리는 이미지는 **JPEG** 로 굽는다. PNG 를 그대로 올리지 말 것.
 *
 * Meta 가 문서에 적어 둔 인스타 이미지 포맷은 JPEG 하나뿐이다. PNG 도 그동안 받아 줬지만
 * 그건 그쪽 변환기(Telephoto)로 JPEG 로 바꾼 뒤 처리하는 **비공식 경로**고,
 * 2026-08-15 아침 캐러셀이 정확히 그 변환에서 통째로 죽었다:
 *
 *   36001 / 2207084 — "image/png 이미지 형식이 감지되었으나 처리를 위해 JPEG 로
 *   변환하지 못했습니다. 오류: Telephoto call failed (External error #1:
 *   PNG chunk is missing required data)"
 *
 * 그때 올라간 PNG 8장은 전부 **멀쩡한 파일**이었다 — 서명·청크 구성·CRC·전체 길이를
 * 전수 검사해 오류 0. 즉 우리가 깨진 파일을 올린 게 아니라 그쪽 변환이 실패한 것이고,
 * 우리가 통제할 수 있는 건 "변환을 시키지 않는 것" 하나뿐이다.
 *
 * 부수 효과로 업로드 용량이 1/10 이하로 줄어(카드 한 장 2.9MB → 300KB 수준) Meta 가
 * 원본을 받아 가는 단계의 실패 확률도 같이 낮아진다.
 */

// 카드에는 글자가 많다. 4:2:0 서브샘플링을 쓰면 형광 라임/앰버 글자 경계에 색 번짐이
// 생기므로 4:4:4 로 끈다. 그래도 PNG 대비 10분의 1 이하다.
const JPEG_OPTS = { quality: 92, chromaSubsampling: "4:4:4", mozjpeg: true } as const;

/** `foo.png` → `foo.jpg`. png 가 아니면 그대로 돌려준다. */
export function jpegTwin(name: string): string {
  return name.replace(/\.png$/i, ".jpg");
}

/**
 * PNG 을 같은 디렉터리에 JPEG 로 한 장 더 굽고 그 파일명을 돌려준다.
 * PNG 원본은 남긴다 — 릴스/틱톡 영상이 ffmpeg 입력으로 그대로 쓰기 때문이다.
 */
export async function writeJpegTwin(dir: string, pngName: string): Promise<string> {
  if (!/\.png$/i.test(pngName)) return pngName;
  const src = path.join(dir, pngName);
  if (!fs.existsSync(src)) throw new Error(`JPEG 변환 원본 없음: ${src}`);
  const out = jpegTwin(pngName);
  await sharp(src)
    // JPEG 에는 알파가 없다. 카드는 전부 불투명하지만, 알파가 남아 있으면 sharp 가
    // 검정으로 눌러 얼룩이 생길 수 있어 사이트 배경색으로 명시적으로 깐다.
    .flatten({ background: "#0a0a0a" })
    .jpeg(JPEG_OPTS)
    .toFile(path.join(dir, out));
  return out;
}

/**
 * 게시 스크립트가 실제로 올릴 파일명. 매니페스트에 JPEG 트윈이 등록돼 있으면 그걸 쓴다.
 *
 * 트윈이 없으면 PNG 로 떨어진다 — 변환 스텝이 빠졌다고 게시를 통째로 멈추는 것보다,
 * 몇 달간 실제로 동작하던 경로로 한 번 더 시도하는 편이 낫다. 대신 경고를 남긴다
 * (워크플로에 스텝이 있는지는 `test:ig-image` 가 따로 검사한다).
 */
export function igImageName(name: string, manifest: Manifest): string {
  const twin = jpegTwin(name);
  if (manifest.jpeg?.includes(twin)) return twin;
  if (twin !== name) {
    console.warn(`⚠️  ${name}: JPEG 트윈 없음 — PNG 로 올린다(Meta 변환 의존, 실패 이력 있음)`);
  }
  return name;
}

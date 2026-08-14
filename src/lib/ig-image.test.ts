import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import sharp from "sharp";
import { igImageName, jpegTwin, writeJpegTwin } from "./ig-image";
import type { Manifest } from "./manifest";

const WORKFLOWS = [
  ".github/workflows/instagram.yml",
  ".github/workflows/instagram-morning.yml",
];

function manifest(over: Partial<Manifest> = {}): Manifest {
  return { date: "0815", files: ["main-0815.png", "outro.png"], ...over };
}

test("jpegTwin: png 확장자만 바꾼다", () => {
  assert.equal(jpegTwin("main-0815.png"), "main-0815.jpg");
  assert.equal(jpegTwin("outro.PNG"), "outro.jpg");
  // 영상·이미 jpg 는 건드리지 않는다
  assert.equal(jpegTwin("reel.mp4"), "reel.mp4");
  assert.equal(jpegTwin("story.jpg"), "story.jpg");
});

test("igImageName: 매니페스트에 트윈이 있으면 JPEG 를 올린다", () => {
  const m = manifest({ jpeg: ["main-0815.jpg", "outro.jpg"] });
  assert.equal(igImageName("main-0815.png", m), "main-0815.jpg");
  assert.equal(igImageName("outro.png", m), "outro.jpg");
});

test("igImageName: 트윈이 없으면 PNG 로 떨어진다(게시를 멈추지 않는다)", () => {
  assert.equal(igImageName("main-0815.png", manifest()), "main-0815.png");
  // 목록에 그 파일만 빠진 경우도 개별로 판단한다
  const partial = manifest({ jpeg: ["main-0815.jpg"] });
  assert.equal(igImageName("main-0815.png", partial), "main-0815.jpg");
  assert.equal(igImageName("outro.png", partial), "outro.png");
});

test("writeJpegTwin: 실제로 JPEG 가 나오고 크기·해상도가 맞는다", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hhs-igjpeg-"));
  try {
    // 실제 카드와 같은 4:5 · RGBA. 단색이면 압축률이 비현실적이라 노이즈를 깐다.
    const w = 1080;
    const h = 1350;
    const raw = Buffer.alloc(w * h * 4);
    for (let i = 0; i < raw.length; i += 4) {
      raw[i] = (i * 7) % 256;
      raw[i + 1] = (i * 13) % 256;
      raw[i + 2] = (i * 29) % 256;
      raw[i + 3] = 255;
    }
    const png = path.join(dir, "main-0815.png");
    await sharp(raw, { raw: { width: w, height: h, channels: 4 } }).png().toFile(png);

    const out = await writeJpegTwin(dir, "main-0815.png");
    assert.equal(out, "main-0815.jpg");

    const buf = fs.readFileSync(path.join(dir, out));
    // JPEG SOI 매직. 여기서 PNG 시그니처가 나오면 변환이 안 된 것이다.
    assert.equal(buf[0], 0xff);
    assert.equal(buf[1], 0xd8);

    const meta = await sharp(buf).metadata();
    assert.equal(meta.format, "jpeg");
    assert.equal(meta.width, w);
    assert.equal(meta.height, h);
    // JPEG 에 알파가 남아 있으면 안 된다
    assert.equal(meta.hasAlpha, false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeJpegTwin: png 가 아니면 그대로 통과시킨다", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hhs-igjpeg-"));
  try {
    assert.equal(await writeJpegTwin(dir, "reel.mp4"), "reel.mp4");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("writeJpegTwin: 원본이 없으면 조용히 넘어가지 않고 실패한다", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hhs-igjpeg-"));
  try {
    await assert.rejects(() => writeJpegTwin(dir, "없는파일.png"), /JPEG 변환 원본 없음/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// 🔴 이게 이 가드의 핵심이다. 라이브러리가 아무리 맞아도 워크플로가 변환 스텝을
// 안 돌리거나 push 뒤에 돌리면 JPEG 가 CDN 에 없어 PNG 로 폴백한다 —
// 2026-08-15 아침 캐러셀 전멸이 정확히 그 상태였다.
for (const wf of WORKFLOWS) {
  test(`${wf}: JPEG 변환이 insta-media push 앞에 있다`, () => {
    const yml = fs.readFileSync(path.resolve(wf), "utf8");
    const jpegAt = yml.indexOf("npm run ig:jpeg");
    const pushAt = yml.indexOf("id: media");
    assert.ok(jpegAt >= 0, `${wf} 에 'npm run ig:jpeg' 스텝이 없다`);
    assert.ok(pushAt >= 0, `${wf} 에 insta-media push 스텝(id: media)이 없다`);
    assert.ok(
      jpegAt < pushAt,
      `${wf}: JPEG 변환이 push 뒤에 있으면 JPEG 가 CDN 에 안 올라간다`,
    );
  });
}

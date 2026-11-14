import { readFile } from "node:fs/promises";
import path from "node:path";

/**
 * OG 카드(satori)에 쓰는 폰트·로고.
 *
 * 🔴 2026-11-14 (이슈 #96): 매치·가이드 OG 를 **빌드 때 미리 굽도록** 바꾸면서 만들었다.
 * 계정이 Hobby Active CPU 초과(`softBlock.blockedDueToOverageType = fluidCpuDuration`)로
 * 잠겼고, 12시간 Active CPU 1위가 런타임 OG 렌더였다(2026-11-01 실측 63회 49초).
 *
 * 빌드 중에는 `public/` 을 fs 로 읽는다. 종전처럼 `https://haeseol.com/...` 을 받으면
 * 사이트가 402 로 잠긴 동안(=지금) 빌드가 깨진 폰트로 실패하고, 빌드마다 3MB 를 받는다.
 * 런타임(서버리스)에선 public 파일이 번들에 안 실려 fs 가 실패하므로(종전 500 사고)
 * 그때만 HTTPS 로 받는다. 현재 두 OG 라우트 모두 런타임엔 렌더하지 않으므로
 * 런타임 분기는 안전망이다.
 */
export type OgAssets = { bold: ArrayBuffer; regular: ArrayBuffer; logo: string };

const BASE = "https://haeseol.com";
const FILES = {
  bold: "fonts/Pretendard-Bold.otf",
  regular: "fonts/Pretendard-Regular.otf",
  // 원본(1.26MB) 대신 1200px 축소본(199KB).
  logo: "logo-1200.png",
} as const;

function toArrayBuffer(buf: Buffer): ArrayBuffer {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer;
}

async function readLocal(rel: string): Promise<ArrayBuffer> {
  return toArrayBuffer(await readFile(path.join(process.cwd(), "public", rel)));
}

async function readRemote(rel: string): Promise<ArrayBuffer> {
  // Data Cache 는 배포 간에도 유지되므로 force-cache 대신 하루로 묶는다(로고 교체 반영).
  const r = await fetch(`${BASE}/${rel}`, { next: { revalidate: 86400 } });
  if (!r.ok) throw new Error(`OG 자산 ${rel} → HTTP ${r.status}`);
  return r.arrayBuffer();
}

async function read(rel: string): Promise<ArrayBuffer> {
  try {
    return await readLocal(rel);
  } catch {
    return readRemote(rel);
  }
}

let assetsPromise: Promise<OgAssets> | null = null;

export function loadOgAssets(): Promise<OgAssets> {
  if (!assetsPromise) {
    assetsPromise = (async () => {
      const [bold, regular, logoBuf] = await Promise.all([
        read(FILES.bold),
        read(FILES.regular),
        read(FILES.logo),
      ]);
      return {
        bold,
        regular,
        logo: `data:image/png;base64,${Buffer.from(logoBuf).toString("base64")}`,
      };
    })().catch((e) => {
      // 실패를 메모해 두면 인스턴스 수명 내내 같은 오류를 낸다.
      assetsPromise = null;
      throw e;
    });
  }
  return assetsPromise;
}

/** `next build` 의 정적 생성 중인지. 빌드 워커는 이 값을 물려받는다(next/dist/build/index.js). */
export function isBuildPhase(): boolean {
  return process.env.NEXT_PHASE === "phase-production-build";
}

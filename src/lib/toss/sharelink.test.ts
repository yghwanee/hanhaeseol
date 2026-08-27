import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

/**
 * 토스 쉐어링크 연동 가드 — 네트워크 없이 도는 것만.
 *
 * 지키려는 것 두 가지:
 *  ① Secret Key·토큰이 브라우저로 새지 않는다(서버 대 서버 전용 API 다).
 *  ② 토큰 캐시 파일이 커밋되지 않는다(약 1년짜리 베어러 토큰이다).
 */

const TOSS_LIB = path.resolve("src/lib/toss");

test("토스 클라이언트를 src/app 에서 import 하지 않는다", () => {
  // Next 런타임에서 부르면 Secret Key 가 번들에 들어가고, 나가는 IP 도 고정이 아니라
  // 어차피 SHARELINK_OPENAPI_ACCESS_DENIED 를 받는다. 스크립트에서만 쓴다.
  const offenders: string[] = [];
  const walk = (dir: string) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(ts|tsx)$/.test(e.name)) {
        const src = fs.readFileSync(p, "utf8");
        if (/from\s+["']@\/lib\/toss\//.test(src)) offenders.push(p);
      }
    }
  };
  walk(path.resolve("src/app"));
  assert.deepEqual(
    offenders,
    [],
    `src/app 에서 토스 클라이언트를 import 했다:\n  ${offenders.join("\n  ")}\n` +
      "  → 토스 Open API 는 서버 대 서버 전용이다. 스크립트에서 받아 데이터로 넘길 것.",
  );
});

test("토큰 캐시 파일이 gitignore 에 있다", () => {
  const gi = fs.readFileSync(path.resolve(".gitignore"), "utf8");
  assert.ok(
    gi.includes(".toss-sharelink-token.json"),
    ".toss-sharelink-token.json 이 .gitignore 에 없다 — 베어러 토큰이 커밋된다",
  );
});

test("자격증명을 코드에 하드코딩하지 않는다", () => {
  const offenders: string[] = [];
  for (const f of fs.readdirSync(TOSS_LIB)) {
    if (!/\.ts$/.test(f) || f.endsWith(".test.ts")) continue;
    const src = fs.readFileSync(path.join(TOSS_LIB, f), "utf8");
    // Access/Secret Key 는 반드시 process.env 로만 들어와야 한다.
    for (const m of src.matchAll(/(client_secret|secretKey|accessKey)\s*[:=]\s*["'][^"']+["']/g)) {
      offenders.push(`${f}: ${m[0]}`);
    }
  }
  assert.deepEqual(offenders, [], `자격증명이 하드코딩됐다:\n  ${offenders.join("\n  ")}`);
});

test("추적 안 되는 productUrl 을 링크로 쓰지 말라는 경고가 남아 있다", () => {
  // 목록 API 의 productUrl 은 추적이 안 붙어 수익이 안 잡힌다. 실수하기 딱 좋은 자리라
  // 타입·API 양쪽에 경고를 박아 뒀다. 지워지면 다음 사람이 그대로 밟는다.
  const types = fs.readFileSync(path.join(TOSS_LIB, "types.ts"), "utf8");
  const api = fs.readFileSync(path.join(TOSS_LIB, "api.ts"), "utf8");
  assert.ok(types.includes("추적 안 되는"), "types.ts 의 productUrl 경고가 사라졌다");
  assert.ok(api.includes("shortUrl"), "api.ts 의 링크 발급 안내가 사라졌다");
});

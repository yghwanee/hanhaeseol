import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * 네이버 스포츠 API 호출은 전부 naverFetch(TLS 1.2 고정)를 거쳐야 한다.
 * 전역 fetch 로 부르면 TLS 1.3 연결에서 응답이 안 와 수집이 통째로 멈춘다(2026-10-26 장애).
 */
const SRC = path.join(process.cwd(), "src");

function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (/\.tsx?$/.test(e.name) && !e.name.endsWith(".test.ts")) acc.push(p);
  }
  return acc;
}

test("api-gw.sports.naver.com 을 쓰는 파일은 naverFetch 를 쓴다", () => {
  const users = walk(SRC).filter(
    (f) => fs.readFileSync(f, "utf8").includes("api-gw.sports.naver.com") && !f.endsWith("naver-fetch.ts"),
  );
  assert.ok(users.length > 0);
  for (const f of users) {
    assert.match(fs.readFileSync(f, "utf8"), /naverFetch\(/, `${path.relative(SRC, f)} 가 naverFetch 를 안 쓴다`);
  }
});

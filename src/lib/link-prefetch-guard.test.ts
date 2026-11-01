import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

/**
 * next/link 는 화면에 보이는 링크를 미리 받는다. 2026-11-01 실측: 홈 방문 1회에 RSC 12건·1.2MB(압축 해제),
 * 그중 3~4건이 /match 다. Hobby 한도가 빠듯해 누르지 않은 페이지를 받지 않는다.
 * prefetch={false} 여도 마우스를 올리면 그 링크는 받으므로 PC 이동 속도는 크게 안 잃는다.
 */
function walk(dir: string, acc: string[] = []): string[] {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, acc);
    else if (e.name.endsWith(".tsx")) acc.push(p);
  }
  return acc;
}

test("모든 next/link 에 prefetch={false} 가 있다", () => {
  const bad: string[] = [];
  for (const f of walk(path.join(process.cwd(), "src"))) {
    const src = fs.readFileSync(f, "utf8");
    if (!src.includes('from "next/link"')) continue;
    for (const m of src.matchAll(/<Link\s[^>]*?>/g)) {
      if (!m[0].includes("prefetch={false}")) bad.push(`${path.relative(process.cwd(), f)}: ${m[0].slice(0, 60)}`);
    }
    if (/<Link>/.test(src)) bad.push(path.relative(process.cwd(), f));
  }
  assert.deepEqual(bad, []);
});

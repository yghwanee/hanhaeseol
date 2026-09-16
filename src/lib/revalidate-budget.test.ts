import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * `revalidate` 예산 가드.
 *
 * 2026-09-16 까지 색인 대상 페이지가 전부 `revalidate = 3600` 이었다. 데이터는 배포
 * 번들 안 파일이라 재생성해도 **같은 HTML 이 다시 나오는데**(`server-data.ts` 주석),
 * 623페이지 × 시간당 = 이론상 월 44.8만 회였고 대시보드 실측이
 * ISR Writes 244,795/200,000 · Active CPU 8h33m/4h 였다(팀 페이지 렌더당 860ms).
 *
 * 그래서 값을 배포 주기에 맞췄다. `deploy.yml` 이 KST 00:10·06:10·12:10·18:10 으로
 * 하루 4번 배포하고 배포가 정적 페이지를 전부 다시 굽는다. 6h = 그 간격과 같은 값이라
 * 실제로는 거의 발화하지 않는 안전망이다.
 *
 * 규칙(정책 정본은 `src/app/page.tsx` 주석):
 *   · 서버 렌더가 날짜를 읽는다 → `21600` 이상
 *   · 안 읽는다 → `false`
 *
 * 🔴 이 가드가 막는 것은 **되돌림**이다. 짧은 값은 빌드도 타입체크도 통과하고
 * 화면도 멀쩡해서, 한도가 잠길 때까지 아무도 모른다(2026-08-18 에 실제로 잠겼다).
 */

const APP_DIR = join(process.cwd(), "src", "app");

/** 배포 주기(6h)와 같은 값. 이보다 짧으면 배포가 이미 굽는 것을 또 굽는 것이다. */
const MIN_REVALIDATE_SECONDS = 21_600;

/** API 라우트는 페이지가 아니다 — 응답이 매번 달라야 하는 곳이라 예산 규칙 밖이다. */
function isApiRoute(file: string): boolean {
  return relative(APP_DIR, file).split(/[\/]/)[0] === "api";
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(p);
  }
  return out;
}

/** 주석 안의 예시 숫자가 위반으로 잡히면 안 된다. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

type Decl = { file: string; raw: string };

function declarations(): Decl[] {
  const out: Decl[] = [];
  for (const file of walk(APP_DIR)) {
    const src = stripComments(readFileSync(file, "utf8"));
    const m = src.match(/export\s+const\s+revalidate\s*=\s*([^;]+);/);
    if (m) out.push({ file, raw: m[1].trim() });
  }
  return out;
}

test("페이지 revalidate 는 배포 주기(6h)보다 짧을 수 없다", () => {
  const decls = declarations().filter((d) => !isApiRoute(d.file));
  assert.ok(
    decls.length >= 6,
    `revalidate 선언을 거의 못 찾음(${decls.length}) — 가드 자체가 깨진 것`,
  );

  const violations: string[] = [];
  for (const d of decls) {
    if (d.raw === "false") continue;
    const seconds = Number(d.raw.replace(/_/g, ""));
    assert.ok(
      Number.isFinite(seconds),
      `${relative(process.cwd(), d.file)}: revalidate 를 리터럴로 적을 것(받은 값 ${d.raw}). ` +
        `Next 는 이 값을 정적으로 읽어야 해서 import 한 상수를 못 쓴다.`,
    );
    if (seconds < MIN_REVALIDATE_SECONDS) {
      violations.push(
        `${relative(process.cwd(), d.file)}: ${seconds}초 — ` +
          `배포가 하루 4번(6h 간격) 같은 페이지를 이미 굽는다`,
      );
    }
  }

  assert.deepEqual(
    violations,
    [],
    `revalidate 가 배포 주기보다 짧다. 데이터는 배포 번들 안에 있어 재생성해도 같은 HTML 이고,\n` +
      `이 값이 ISR Writes 와 Active CPU 를 직접 태운다(2026-08-18 Hobby 잠김 이력).\n` +
      `근거와 분류 규칙은 src/app/page.tsx 의 "revalidate 정책 정본" 주석.\n\n` +
      violations.join("\n"),
  );
});

test("날짜를 안 읽는 페이지는 revalidate 를 아예 갖지 않거나 false 다", () => {
  const DATE_READERS = /getTodayString|new Date\(\)|Date\.now\(\)|isGameFinished/;

  /**
   * 서버 렌더가 날짜를 읽는지는 페이지 파일만 봐서는 모른다 — `FilteredScheduleView`
   * 처럼 날짜를 읽는 서버 컴포넌트를 부르는 경우가 있다. 그래서 페이지가 여는
   * 로컬 import 를 한 겹 따라간다. (한 겹이면 지금 구조에선 충분하다)
   */
  const readsDate = (file: string, depth = 1): boolean => {
    let src: string;
    try {
      src = stripComments(readFileSync(file, "utf8"));
    } catch {
      return false;
    }
    if (DATE_READERS.test(src)) return true;
    if (depth <= 0) return false;
    for (const m of src.matchAll(/from\s+"(@\/[^"]+)"/g)) {
      const base = join(process.cwd(), "src", m[1].slice(2));
      for (const ext of [".tsx", ".ts", "/index.tsx", "/index.ts"]) {
        try {
          if (statSync(base + ext).isFile() && readsDate(base + ext, depth - 1)) return true;
        } catch {
          /* 없는 확장자 조합 */
        }
      }
    }
    return false;
  };

  const wrong: string[] = [];
  for (const d of declarations().filter((x) => !isApiRoute(x.file))) {
    if (d.raw === "false") continue;
    if (!readsDate(d.file)) {
      wrong.push(
        `${relative(process.cwd(), d.file)}: 날짜를 안 읽는데 revalidate=${d.raw} — false 로 둘 것`,
      );
    }
  }

  assert.deepEqual(
    wrong,
    [],
    `재생성해도 바이트가 안 바뀌는 페이지에 시간 예산이 붙어 있다.\n` + wrong.join("\n"),
  );
});

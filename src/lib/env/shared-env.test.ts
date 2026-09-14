import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import {
  sharedEnvCandidates,
  describeEnvSources,
  SHARED_FILE_NAME,
  SHARED_REL_DIR,
} from "./shared-env";

/**
 * 공용 자격증명 가드.
 *
 * 지키는 것 둘:
 *  ① 공용 파일이 **레포 안으로 들어오지 않는다** — `hanhaeseol` 은 public 레포라
 *    들어오는 순간 키가 공개된다. 되돌릴 수 없는 종류의 사고다.
 *  ② 자격증명 **값이 로그에 찍히지 않는다** — 터미널 출력은 스크린샷으로 남는다.
 */

test("공용 파일 후보가 레포 밖이다", () => {
  const repo = path.resolve(".");
  const candidates = sharedEnvCandidates({
    USERPROFILE: "C:\\Users\\tester",
    OneDrive: "C:\\Users\\tester\\OneDrive - Carrot Global",
  });

  assert.ok(candidates.length > 0, "후보가 하나도 없다");
  for (const c of candidates) {
    assert.ok(
      !path.resolve(c).startsWith(repo + path.sep),
      `공용 자격증명 파일이 레포 안을 가리킨다: ${c} — public 레포다`,
    );
  }
});

test("후보 우선순위: 명시 지정 > OneDrive", () => {
  const env: Record<string, string | undefined> = {
    HWANEE_SECRETS_FILE: "D:\\keys\\my.env",
    HWANEE_SECRETS_DIR: "D:\\keys2",
    OneDrive: "C:\\Users\\tester\\OneDrive - Carrot Global",
  };
  const candidates = sharedEnvCandidates(env);
  assert.equal(candidates[0], "D:\\keys\\my.env", "HWANEE_SECRETS_FILE 이 가장 먼저여야 한다");
  assert.equal(candidates[1], path.join("D:\\keys2", SHARED_FILE_NAME));
  assert.ok(
    candidates.some((c) => c.includes(SHARED_REL_DIR)),
    "OneDrive 기본 경로가 후보에 없다",
  );
});

test("OneDrive 환경변수가 없어도 후보를 만든다", () => {
  // OneDrive 폴더명은 PC·계정마다 다르다("OneDrive", "OneDrive - 조직명"). 환경변수가
  // 없는 PC 에서도 홈 디렉터리를 훑어 찾는 경로가 살아 있어야 한다.
  const candidates = sharedEnvCandidates({ USERPROFILE: path.resolve(".") });
  assert.ok(Array.isArray(candidates), "후보 계산이 죽었다");
});

test("출처 요약에 자격증명 값이 섞이지 않는다", () => {
  const line = describeEnvSources({
    localFile: ".env",
    sharedFile: "C:\\x\\hwanee.env",
    filledFromShared: ["TOSS_SHARELINK_SECRET_KEY"],
  });
  // 키 **이름**만 나와야 한다. 값을 담는 구조 자체가 없다는 걸 고정한다.
  assert.ok(line.includes("TOSS_SHARELINK_SECRET_KEY"), "어떤 키가 공용에서 왔는지는 보여야 한다");
  assert.ok(!/=/.test(line), "출처 요약에 key=value 형태가 들어갔다 — 값이 샐 수 있다");
});

test("secrets 스크립트가 값을 그대로 찍지 않는다", () => {
  const src = fs.readFileSync(path.resolve("src/scripts/secrets.ts"), "utf8");
  assert.ok(src.includes("function mask("), "마스킹 함수가 사라졌다");
  // `console.log(... process.env[k] ...)` 처럼 값을 바로 출력하는 형태를 막는다.
  const badLogs = src
    .split("\n")
    .filter((l) => /console\.(log|error)/.test(l) && /\$\{(v|process\.env\[)/.test(l) && !/mask\(/.test(l));
  assert.deepEqual(badLogs, [], `자격증명 값을 그대로 출력한다:\n  ${badLogs.join("\n  ")}`);
});

test("로더를 쓰는 스크립트는 dotenv/config 를 직접 부르지 않는다", () => {
  // dotenv/config 만 쓰면 `.env` 만 읽어서 다른 PC 에서 조용히 실패한다.
  const dir = path.resolve("src/scripts");
  const offenders = fs
    .readdirSync(dir)
    .filter((f) => f.startsWith("toss") && f.endsWith(".ts"))
    .filter((f) => fs.readFileSync(path.join(dir, f), "utf8").includes('import "dotenv/config"'));
  assert.deepEqual(
    offenders,
    [],
    `토스 스크립트가 dotenv/config 를 쓴다(공용 파일을 못 읽는다): ${offenders.join(", ")}`,
  );
});

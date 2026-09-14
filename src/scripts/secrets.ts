/**
 * PC 3대가 같은 자격증명을 쓰게 하는 도구.
 *
 *   npm run secrets            # 지금 어디서 무엇을 읽고 있는지 (값은 안 찍는다)
 *   npm run secrets:push       # 이 PC 의 .env 값을 OneDrive 공용 파일로 올린다
 *   npm run secrets:push -- --key=NAVER_API_KEY   # 목록에 없는 키도 같이 올린다
 *
 * 흐름은 한 번만 하면 된다:
 *   이 PC 에서 `.env` 에 키를 넣고 → `npm run secrets:push`
 *   → 다른 PC 는 아무것도 안 해도 된다(OneDrive 가 동기화하고 로더가 알아서 읽는다).
 *
 * 🔴 공용 파일은 레포 밖(OneDrive)에 있다. 레포는 public 이라 안에 두면 그 즉시 공개다.
 * 🔴 OneDrive 는 회사 클라우드고 평문이다. 여기 올릴 값인지 한 번 더 생각할 것.
 * 🔴 **키를 옮겨도 토스 API 는 다른 PC 에서 바로 안 된다.** 출발지 IP 를 PC 마다
 *    등록해야 한다(업체당 10개). 그 PC 에서 `npm run toss:check` 를 돌리면 등록할
 *    IP 를 찍어 준다.
 */
import {
  loadEnv,
  describeEnvSources,
  findSharedEnvFile,
  sharedEnvCandidates,
  SHARED_FILE_NAME,
  SHARED_REL_DIR,
} from "@/lib/env/shared-env";
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * 3대가 공유할 키 목록. 여기 없는 키는 `--key=` 로 그때그때 올린다.
 * 🔴 GitHub Actions 가 쓰는 값(Secrets 에 이미 있는 것)은 굳이 올릴 필요 없다.
 */
const SHARED_KEYS = [
  "TOSS_SHARELINK_ACCESS_KEY",
  "TOSS_SHARELINK_SECRET_KEY",
  "TOSS_SHARELINK_PUBLISHER_ID",
];

/** 값을 그대로 찍지 않는다. 앞 4자 + 길이만 보여 준다. */
function mask(v: string): string {
  if (!v) return "(빈 값)";
  return v.length <= 6 ? `${v.slice(0, 2)}…(${v.length}자)` : `${v.slice(0, 4)}…(${v.length}자)`;
}

function extraKeys(): string[] {
  return process.argv
    .filter((a) => a.startsWith("--key="))
    .map((a) => a.slice("--key=".length))
    .filter(Boolean);
}

function targetPath(): string {
  const existing = findSharedEnvFile();
  if (existing) return existing;
  // 아직 없으면 우선순위 첫 후보에 만든다(HWANEE_SECRETS_* 를 줬으면 그것, 아니면 OneDrive).
  const candidate = sharedEnvCandidates()[0];
  if (!candidate) {
    throw new Error(
      `공용 파일을 둘 자리를 못 찾았다. OneDrive 가 안 잡히는 PC 면 환경변수로 지정할 것:\n` +
        `  HWANEE_SECRETS_DIR=<폴더>  (그 안에 ${SHARED_FILE_NAME} 을 만든다)`,
    );
  }
  return candidate;
}

function status(): void {
  const info = loadEnv();
  console.log("자격증명 출처\n");
  console.log(`  ${describeEnvSources(info)}\n`);

  if (!info.sharedFile) {
    console.log("  공용 파일이 아직 없다. 후보 경로(위에서부터 먼저 본다):");
    for (const c of sharedEnvCandidates()) console.log(`    ${c}`);
    console.log("\n  → 키가 들어 있는 PC 에서 `npm run secrets:push` 를 한 번 돌리면 만들어진다.");
  }

  console.log("\n공유 대상 키\n");
  const keys = [...SHARED_KEYS, ...extraKeys()];
  let missing = 0;
  for (const k of keys) {
    const v = process.env[k];
    const from = v ? (info.filledFromShared.includes(k) ? "공용" : ".env") : "";
    if (!v) missing += 1;
    console.log(`  ${v ? "✅" : "❌"} ${k.padEnd(30)} ${v ? `${mask(v)}  ← ${from}` : "없음"}`);
  }
  if (missing) {
    console.log(`\n  ${missing}개가 비어 있다. 이 PC 의 .env 에 넣고 \`npm run secrets:push\` 할 것.`);
  }

  console.log(
    "\n🔴 키를 옮겨도 토스는 다른 PC 에서 바로 안 된다 — 출발지 IP 를 PC 마다 등록해야 한다.\n" +
      "   그 PC 에서 `npm run toss:check` 를 돌리면 등록할 IP 가 찍힌다(업체당 10개).",
  );
}

function push(): void {
  const info = loadEnv();
  const dest = targetPath();
  const keys = [...SHARED_KEYS, ...extraKeys()];

  // 올릴 값은 **이 PC 의 .env** 에서만 가져온다. 공용에서 읽어 온 값을 되쓰는 건 의미가 없고,
  // 실수로 빈 값을 덮어써 다른 PC 를 망가뜨리는 사고만 만든다.
  const local = info.localFile ? dotenv.parse(fs.readFileSync(info.localFile)) : {};
  const toWrite: Record<string, string> = {};
  const skipped: string[] = [];
  for (const k of keys) {
    if (local[k]) toWrite[k] = local[k];
    else skipped.push(k);
  }

  if (Object.keys(toWrite).length === 0) {
    console.error("올릴 값이 없다 — 이 PC 의 .env 에 해당 키가 없다.");
    console.error(`  대상 키: ${keys.join(", ")}`);
    process.exit(1);
  }

  // 기존 공용 파일 내용을 보존하고 병합한다(다른 키를 날리지 않는다).
  const existing = fs.existsSync(dest) ? dotenv.parse(fs.readFileSync(dest)) : {};
  const merged = { ...existing, ...toWrite };

  fs.mkdirSync(path.dirname(dest), { recursive: true });
  const header =
    "# 한해설·채운·fadeby 공용 자격증명 (PC 3대 공유)\n" +
    "# 🔴 레포 안으로 옮기지 말 것 — hanhaeseol 은 public 레포다.\n" +
    "# 이 파일은 `npm run secrets:push` 가 갱신한다. 손으로 고쳐도 된다.\n" +
    `# 마지막 갱신: ${new Date().toISOString()}\n\n`;
  const body = Object.keys(merged)
    .sort()
    .map((k) => `${k}=${merged[k]}`)
    .join("\n");
  fs.writeFileSync(dest, header + body + "\n", "utf8");

  console.log(`공용 파일에 저장했다:\n  ${dest}\n`);
  for (const k of Object.keys(toWrite).sort()) {
    console.log(`  ✅ ${k.padEnd(30)} ${mask(toWrite[k])}${existing[k] ? " (덮어씀)" : " (새로 추가)"}`);
  }
  if (skipped.length) console.log(`\n  건너뜀(이 PC .env 에 없음): ${skipped.join(", ")}`);
  console.log(
    `\n다른 PC 에서는 아무것도 안 해도 된다 — OneDrive 동기화만 끝나면 로더가 읽는다.\n` +
      `  확인: 그 PC 에서 \`npm run secrets\`\n` +
      `  🔴 토스 호출은 그 PC 의 IP 도 등록해야 된다 → \`npm run toss:check\` 가 IP 를 찍어 준다.`,
  );
  if (!info.sharedFile) console.log(`\n(경로를 바꾸려면 HWANEE_SECRETS_DIR 환경변수로 지정. 파일명은 ${SHARED_FILE_NAME}, 기본 위치는 OneDrive\\${SHARED_REL_DIR})`);
}

if (process.argv.includes("--push")) push();
else status();

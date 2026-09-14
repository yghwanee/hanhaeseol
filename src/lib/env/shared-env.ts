/**
 * 여러 PC 가 같은 자격증명을 쓰게 하는 로더.
 *
 * 화니는 작업 PC 가 3대인데 `.env` 는 **레포에 안 들어가고(gitignore) 동기화도 안 된다.**
 * 그래서 키를 받을 때마다 PC 마다 손으로 붙여넣는 일이 생긴다. 이 모듈은 그걸 없앤다.
 *
 * 읽는 순서(먼저 잡힌 값이 이긴다 — dotenv 는 이미 있는 변수를 덮지 않는다):
 *   1. 이미 프로세스에 있는 환경변수 (CI 의 GitHub Secrets 등)
 *   2. 레포의 `.env`            — 이 PC 에서만 쓰는 값·임시 덮어쓰기
 *   3. OneDrive 공용 파일        — 3대가 같이 쓰는 값 (여기가 정본)
 *
 * 공용 파일 위치를 찾는 순서:
 *   `HWANEE_SECRETS_FILE` → `HWANEE_SECRETS_DIR/hwanee.env`
 *   → `%OneDrive%/hwanee solutions/_secrets/hwanee.env`
 *   → `%OneDriveCommercial%` · `%OneDriveConsumer%` 같은 경로
 *   → `%USERPROFILE%` 아래 `OneDrive*` 폴더 훑기(회사 계정이면 폴더명에 조직명이 붙는다)
 *
 * 🔴 **공용 파일은 레포 밖에만 둔다.** `hanhaeseol` 레포는 public 이라 안에 들어가면
 * 그 순간 키가 공개된다. 가드(`test:shared-env`)가 레포 안 경로를 막는다.
 *
 * 🔴 OneDrive 는 회사 클라우드다. 평문 키를 두는 것이므로, 잃으면 곤란한 값
 * (구독이 물려 있는 VAPID 등)은 여기 말고 별도 백업도 함께 둘 것.
 */
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/** 공용 파일 이름. 토스만이 아니라 PC 3대가 같이 쓰는 값 전부가 여기 모인다. */
export const SHARED_FILE_NAME = "hwanee.env";
/** OneDrive 안에서의 상대 경로. 전역 CLAUDE.md 가 가리키는 작업 공간과 같은 자리다. */
export const SHARED_REL_DIR = path.join("hwanee solutions", "_secrets");

/** 테스트에서 가짜 환경을 넣을 수 있게 ProcessEnv 가 아니라 느슨한 맵을 받는다. */
export type EnvLike = Record<string, string | undefined>;

/** 공용 파일 후보를 우선순위대로 만든다(존재 여부는 보지 않는다). */
export function sharedEnvCandidates(env: EnvLike = process.env): string[] {
  const out: string[] = [];
  const push = (p: string | undefined | null) => {
    if (p && !out.includes(p)) out.push(p);
  };

  push(env.HWANEE_SECRETS_FILE);
  if (env.HWANEE_SECRETS_DIR) push(path.join(env.HWANEE_SECRETS_DIR, SHARED_FILE_NAME));

  for (const key of ["OneDrive", "OneDriveCommercial", "OneDriveConsumer"]) {
    const base = env[key];
    if (base) push(path.join(base, SHARED_REL_DIR, SHARED_FILE_NAME));
  }

  // OneDrive 환경변수가 없는 PC 대비 — 홈 디렉터리의 OneDrive* 폴더를 훑는다.
  // 회사 계정은 폴더명이 "OneDrive - 조직명" 이라 PC 마다 다를 수 있다.
  const home = env.USERPROFILE || env.HOME;
  if (home) {
    try {
      for (const e of fs.readdirSync(home, { withFileTypes: true })) {
        if (e.isDirectory() && e.name.toLowerCase().startsWith("onedrive")) {
          push(path.join(home, e.name, SHARED_REL_DIR, SHARED_FILE_NAME));
        }
      }
    } catch {
      /* 홈을 못 읽어도 치명적이지 않다 — 후보가 하나 줄어들 뿐이다. */
    }
  }
  return out;
}

/** 실제로 존재하는 공용 파일. 없으면 null. */
export function findSharedEnvFile(env: EnvLike = process.env): string | null {
  return sharedEnvCandidates(env).find((p) => fs.existsSync(p)) ?? null;
}

export interface LoadedEnv {
  /** 레포 `.env` 를 읽었나 */
  localFile: string | null;
  /** 공용 파일 경로 */
  sharedFile: string | null;
  /** 공용 파일에서 **새로** 채워진 키 이름들(값은 담지 않는다) */
  filledFromShared: string[];
}

let loaded: LoadedEnv | null = null;

/**
 * `.env` → 공용 파일 순으로 읽는다. 여러 번 불러도 한 번만 동작한다.
 * 🔴 값을 반환하지 않는다 — 로그·에러 메시지에 자격증명이 섞이는 사고를 막으려고
 * 키 이름만 돌려준다.
 */
export function loadEnv(): LoadedEnv {
  if (loaded) return loaded;

  const localFile = path.resolve(".env");
  const hasLocal = fs.existsSync(localFile);
  if (hasLocal) dotenv.config({ path: localFile, quiet: true });

  const sharedFile = findSharedEnvFile();
  const filledFromShared: string[] = [];
  if (sharedFile) {
    const parsed = dotenv.parse(fs.readFileSync(sharedFile));
    for (const [k, v] of Object.entries(parsed)) {
      // 이미 있는 값은 덮지 않는다 — 이 PC 의 `.env` 와 CI 시크릿이 항상 이긴다.
      if (process.env[k] === undefined || process.env[k] === "") {
        process.env[k] = v;
        filledFromShared.push(k);
      }
    }
  }

  loaded = { localFile: hasLocal ? localFile : null, sharedFile, filledFromShared };
  return loaded;
}

/** 사람에게 보여줄 한 줄. 🔴 값은 절대 찍지 않는다. */
export function describeEnvSources(info: LoadedEnv = loadEnv()): string {
  const parts = [info.localFile ? ".env" : ".env 없음"];
  parts.push(info.sharedFile ? `공용 ${info.sharedFile}` : "공용 파일 없음");
  if (info.filledFromShared.length) parts.push(`공용에서 채움: ${info.filledFromShared.join(", ")}`);
  return parts.join(" · ");
}

// side-effect import(`import "@/lib/env/shared-env"`)만으로도 로드되게 한다.
// 기존 스크립트의 `import "dotenv/config"` 를 이걸로 바꾸면 그대로 동작한다.
loadEnv();

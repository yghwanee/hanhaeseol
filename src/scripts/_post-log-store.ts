/**
 * `data/post-log.json` 읽기·쓰기.
 *
 * 🔴 CI 에서는 **GitHub Contents API** 로 직접 읽고 쓴다. 로컬 체크아웃을 건드리지 않는
 * 이유가 둘이다:
 *   ① `git pull --rebase` 는 워킹트리 전체를 갱신한다. 게시 도중에 편성·결과 JSON 이
 *      바뀌면 뒤에 도는 채널이 앞 채널과 다른 데이터를 보게 된다.
 *   ② 한 실행 안에서 채널마다 즉시 커밋해야 하는데(중간에 죽어도 기록이 남아야 한다),
 *      워킹트리 커밋은 insta-media orphan 브랜치 조작과 얽혀 사고가 나기 쉽다.
 *
 * 로컬(토큰 없음)에서는 파일을 그대로 읽고 쓴다 — 테스트·수동 확인용.
 *
 * 쓰기는 낙관적 동시성이다. sha 를 물고 PUT 하고, 409(그 사이 누가 바꿈)면
 * 다시 읽어 **병합해서** 재시도한다. 원격 기록을 덮어쓰면 그쪽 게시 사실이 사라져
 * 중복 게시로 이어진다.
 */
import fs from "node:fs";
import path from "node:path";
import {
  EMPTY_LOG,
  POST_LOG_PATH,
  mergeLogs,
  normalizeLog,
  pruneLog,
  type PostLog,
} from "../lib/post-log";

const REPO = process.env.GITHUB_REPOSITORY;
const TOKEN = process.env.GH_TOKEN ?? process.env.GITHUB_TOKEN;
const BRANCH = process.env.HHS_POST_LOG_BRANCH ?? "main";
const LOCAL = path.resolve(POST_LOG_PATH);

export function remoteMode(): boolean {
  return Boolean(REPO && TOKEN);
}

interface ContentsRes {
  sha?: string;
  content?: string;
}

async function api(url: string, init?: RequestInit): Promise<Response> {
  // fetch-cache-ok: GH Actions 전용 스크립트라 Next 런타임 캐시와 무관하다.
  return fetch(url, {
    ...init,
    headers: {
      authorization: `Bearer ${TOKEN}`,
      accept: "application/vnd.github+json",
      "content-type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
}

const contentsUrl = () =>
  `https://api.github.com/repos/${REPO}/contents/${POST_LOG_PATH}?ref=${encodeURIComponent(BRANCH)}`;

async function readRemote(): Promise<{ log: PostLog; sha?: string }> {
  const res = await api(contentsUrl());
  if (res.status === 404) return { log: { ...EMPTY_LOG }, sha: undefined };
  if (!res.ok) throw new Error(`post-log 읽기 실패: ${res.status} ${res.statusText}`);
  const json = (await res.json()) as ContentsRes;
  const text = json.content ? Buffer.from(json.content, "base64").toString("utf8") : "";
  let parsed: unknown = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // 🔴 깨진 파일 때문에 게시를 막지 않는다. 빈 기록으로 시작한다
    //    (최악이 중복 한 번이고, 반대는 그날 게시가 통째로 없어지는 것이다).
    console.warn("::warning::post-log JSON 이 깨져 있다 — 빈 기록으로 시작한다");
  }
  return { log: normalizeLog(parsed), sha: json.sha };
}

function readLocal(): PostLog {
  if (!fs.existsSync(LOCAL)) return { ...EMPTY_LOG };
  try {
    return normalizeLog(JSON.parse(fs.readFileSync(LOCAL, "utf8")));
  } catch {
    return { ...EMPTY_LOG };
  }
}

/** 실패해도 throw 하지 않는다 — 읽기 실패로 게시를 막는 것이 더 나쁘다(fail-open). */
export async function loadPostLog(): Promise<PostLog> {
  if (!remoteMode()) return readLocal();
  try {
    return (await readRemote()).log;
  } catch (e) {
    console.warn(`::warning::post-log 원격 읽기 실패 — 로컬 사본으로 대체: ${(e as Error).message}`);
    return readLocal();
  }
}

function serialize(log: PostLog): string {
  const sortKeys = <T>(rec: Record<string, T>) =>
    Object.fromEntries(Object.entries(rec).sort(([a], [b]) => a.localeCompare(b)));
  return `${JSON.stringify({ posted: sortKeys(log.posted), notified: sortKeys(log.notified) }, null, 2)}\n`;
}

function writeLocal(log: PostLog) {
  fs.mkdirSync(path.dirname(LOCAL), { recursive: true });
  fs.writeFileSync(LOCAL, serialize(log));
}

/**
 * 기록을 갱신한다. `mutate` 는 **최신 원격 기록을 받아** 새 기록을 돌려준다 —
 * 409 재시도 때마다 다시 호출되므로 순수 함수여야 한다.
 *
 * 🔴 **추가 전용이다.** mutate 에서 키를 지워도 병합(mergeLogs)이 원격 값을 되살린다.
 * 게시 사실이 실수로 사라지면 그 채널이 다시 올라가 중복 게시가 되므로 그렇게 짰다.
 * 오래된 기록은 pruneLog 가 병합 뒤에 걷어낸다.
 *
 * 실패해도 throw 하지 않는다. 게시는 이미 끝났으므로 여기서 프로세스를 죽이면
 * 워크플로가 빨간불이 되고, 사람이 재실행해 **중복 게시**를 만든다.
 * 대신 경고를 남긴다 — 기록 유실은 다음 실행에서 중복 한 번으로 드러난다.
 */
export async function updatePostLog(
  mutate: (log: PostLog) => PostLog,
  message: string,
  today: string,
): Promise<PostLog> {
  if (!remoteMode()) {
    const next = pruneLog(mutate(readLocal()), today);
    writeLocal(next);
    return next;
  }

  let lastErr = "";
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      const { log: remote, sha } = await readRemote();
      const next = pruneLog(mergeLogs(remote, mutate(remote)), today);
      const res = await api(`https://api.github.com/repos/${REPO}/contents/${POST_LOG_PATH}`, {
        method: "PUT",
        body: JSON.stringify({
          message,
          content: Buffer.from(serialize(next), "utf8").toString("base64"),
          branch: BRANCH,
          ...(sha ? { sha } : {}),
        }),
      });
      if (res.ok) {
        writeLocal(next);
        return next;
      }
      lastErr = `${res.status} ${res.statusText}`;
      // 409/422 = 그 사이 다른 실행이 커밋했다. 다시 읽어 병합 후 재시도.
      if (res.status !== 409 && res.status !== 422) break;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    } catch (e) {
      lastErr = (e as Error).message;
      await new Promise((r) => setTimeout(r, 400 * attempt));
    }
  }
  console.warn(`::warning::post-log 갱신 실패(${lastErr}) — 기록 없이 진행한다`);
  return mutate(await loadPostLog());
}

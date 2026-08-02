import fs from "node:fs";
import path from "node:path";

/**
 * 소셜 게시 채널별 성공/실패 기록.
 *
 * 왜 필요한가: 워크플로가 실패하면 텔레그램에 "❌ 실패, 로그 확인"만 갔다.
 * 그런데 게시 스텝은 `always()` 라 5개 중 일부만 실패하는 게 정상 경로다
 * (2026-08-02 저녁: 캐러셀·스토리·유튜브·틱톡은 올라가고 릴스만 실패).
 * 그 상태로 워크플로를 통째 재실행하면 성공했던 4개가 **중복 게시**된다.
 * 그래서 "무엇이 안 올라갔는지"를 채널 단위로 남기고, 그것만 재실행한다.
 */

export const CHANNELS = ["carousel", "reel", "story", "youtube", "tiktok"] as const;
export type Channel = (typeof CHANNELS)[number];

export const CHANNEL_LABEL: Record<Channel, string> = {
  carousel: "인스타 캐러셀",
  reel: "인스타 릴스",
  story: "인스타 스토리",
  youtube: "유튜브 쇼츠",
  tiktok: "틱톡",
};

export type PostStatus = "ok" | "fail";

export type PostEntry = {
  channel: Channel;
  status: PostStatus;
  /** 성공이면 media id 등, 실패면 에러 메시지 */
  detail: string;
  at: string;
};

export const REPORT_DIR = path.resolve("generated/instagram");
export const REPORT_PATH = path.join(REPORT_DIR, "post-report.json");

export function readReport(): PostEntry[] {
  if (!fs.existsSync(REPORT_PATH)) return [];
  try {
    const parsed = JSON.parse(fs.readFileSync(REPORT_PATH, "utf8"));
    return Array.isArray(parsed) ? (parsed as PostEntry[]) : [];
  } catch {
    return [];
  }
}

export function recordResult(channel: Channel, status: PostStatus, detail: string) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  // 같은 채널을 재시도하면 마지막 결과만 남긴다.
  const entries = readReport().filter((e) => e.channel !== channel);
  entries.push({ channel, status, detail, at: new Date().toISOString() });
  fs.writeFileSync(REPORT_PATH, JSON.stringify(entries, null, 2));
}

/**
 * 이번 실행에서 게시하기로 한 채널 목록. 워크플로가 `HHS_CHANNELS` 로 넘긴다
 * (예: `carousel,reel,story,youtube,tiktok`). 없으면 전체로 본다.
 * 이게 있어야 "총 5개 중 1개 실패" 같은 분모를 정확히 쓸 수 있다.
 */
export function expectedChannels(raw = process.env.HHS_CHANNELS): Channel[] {
  if (!raw?.trim()) return [...CHANNELS];
  const wanted = new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean),
  );
  const picked = CHANNELS.filter((c) => wanted.has(c));
  return picked.length > 0 ? picked : [...CHANNELS];
}

export type ChannelOutcome = {
  channel: Channel;
  label: string;
  status: PostStatus | "skipped";
  detail: string;
};

export type Summary = {
  outcomes: ChannelOutcome[];
  ok: Channel[];
  failed: Channel[];
  /** 대상이었는데 기록이 없는 채널 = 선행 단계 실패 등으로 아예 실행되지 않음 */
  skipped: Channel[];
  total: number;
};

export function summarize(
  expected: Channel[] = expectedChannels(),
  entries: PostEntry[] = readReport(),
): Summary {
  const byChannel = new Map(entries.map((e) => [e.channel, e]));
  const outcomes: ChannelOutcome[] = expected.map((channel) => {
    const entry = byChannel.get(channel);
    return {
      channel,
      label: CHANNEL_LABEL[channel],
      status: entry?.status ?? "skipped",
      detail: entry?.detail ?? "실행되지 않음 (선행 단계 실패 가능)",
    };
  });
  return {
    outcomes,
    ok: outcomes.filter((o) => o.status === "ok").map((o) => o.channel),
    failed: outcomes.filter((o) => o.status === "fail").map((o) => o.channel),
    skipped: outcomes.filter((o) => o.status === "skipped").map((o) => o.channel),
    total: expected.length,
  };
}

const ICON: Record<ChannelOutcome["status"], string> = {
  ok: "✅",
  fail: "❌",
  skipped: "⏭️",
};

/** 에러 메시지는 텔레그램에서 읽을 만한 길이로 자른다. */
function short(detail: string, max = 160): string {
  const oneLine = detail.replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine;
}

/**
 * 텔레그램 본문. 실패가 하나라도 있으면 "총 N개 중 M개 실패"로 시작하고,
 * 마지막에 **실패한 것만 골라 재실행하는 명령**을 붙인다.
 */
export function formatReport(opts: {
  summary: Summary;
  title: string;
  workflow: string;
}): string {
  const { summary, title, workflow } = opts;
  const bad = [...summary.failed, ...summary.skipped];
  const head =
    bad.length === 0
      ? `${title} 업로드 완료 (${summary.total}개 전부 성공)`
      : `${title} 업로드 실패 — 총 ${summary.total}개 중 ${bad.length}개 안 올라감`;

  const lines = [head, ""];
  for (const o of summary.outcomes) {
    lines.push(
      o.status === "ok"
        ? `${ICON[o.status]} ${o.label}`
        : `${ICON[o.status]} ${o.label} — ${short(o.detail)}`,
    );
  }

  if (bad.length > 0) {
    lines.push("");
    lines.push("🔁 안 올라간 것만 재실행 (성공분 중복 방지):");
    lines.push(`gh workflow run ${workflow} -f only=${bad.join(",")}`);
  }
  return lines.join("\n");
}

/**
 * 게시 스크립트 공통 래퍼. 성공/실패를 기록하고, 실패는 그대로 프로세스를 죽인다
 * (워크플로 스텝이 빨간불이어야 실패 알림이 돈다).
 */
export async function runWithReport(
  channel: Channel,
  fn: () => Promise<string | void>,
): Promise<void> {
  try {
    const detail = (await fn()) || "게시 완료";
    recordResult(channel, "ok", detail);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    recordResult(channel, "fail", msg);
    console.error("❌", msg);
    process.exit(1);
  }
}

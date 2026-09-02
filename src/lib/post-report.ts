import fs from "node:fs";
import path from "node:path";
import type { PostSlot } from "./post-slot";

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

/**
 * 🔴 슬롯별 기대 채널 — **분모의 단일 출처**.
 *
 * 아침은 틱톡을 올리지 않는다(하루 1회 = 도배 신호 완화, 작업36). 종전에는 이
 * 목록이 워크플로 bash(`ALL="carousel reel story youtube"`)에 적혀 있었고,
 * 게시 계획·감시견·따라잡기가 각자 따로 알고 있었다. 한쪽만 고치면 감시견이
 * "틱톡이 안 올라갔다"고 매일 짖거나, 반대로 빠진 걸 못 본다.
 * 여기 한 곳만 고친다.
 */
export const SLOT_CHANNELS: Record<PostSlot, Channel[]> = {
  morning: ["carousel", "reel", "story", "youtube"],
  evening: ["carousel", "reel", "story", "youtube", "tiktok"],
};

export function channelsForSlot(slot: PostSlot): Channel[] {
  return [...SLOT_CHANNELS[slot]];
}

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
  /**
   * 이번 실행에서 **실제로 새로 올렸는가**. `false` 면 post-log 에 이미 있어
   * 건너뛴 것이다(재실행). 텔레그램이 "하루 한 통" 을 판정할 때 이걸 본다 —
   * 새로 올린 게 없고 이미 알렸으면 침묵한다.
   */
  fresh?: boolean;
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

export function recordResult(
  channel: Channel,
  status: PostStatus,
  detail: string,
  fresh = true,
) {
  fs.mkdirSync(REPORT_DIR, { recursive: true });
  // 같은 채널을 재시도하면 마지막 결과만 남긴다.
  const entries = readReport().filter((e) => e.channel !== channel);
  entries.push({ channel, status, detail, at: new Date().toISOString(), fresh });
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
  /** 이번 실행에서 새로 올린 것인가(재실행에서 건너뛴 건 false) */
  fresh: boolean;
};

export type Summary = {
  outcomes: ChannelOutcome[];
  ok: Channel[];
  failed: Channel[];
  /** 대상이었는데 기록이 없는 채널 = 선행 단계 실패 등으로 아예 실행되지 않음 */
  skipped: Channel[];
  /** 이번 실행에서 실제로 새로 올린 채널 */
  fresh: Channel[];
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
      fresh: entry?.fresh !== false,
    };
  });
  return {
    outcomes,
    ok: outcomes.filter((o) => o.status === "ok").map((o) => o.channel),
    failed: outcomes.filter((o) => o.status === "fail").map((o) => o.channel),
    skipped: outcomes.filter((o) => o.status === "skipped").map((o) => o.channel),
    fresh: outcomes.filter((o) => o.status === "ok" && o.fresh).map((o) => o.channel),
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
    if (o.status === "ok") {
      lines.push(`${ICON[o.status]} ${o.label}${o.fresh ? "" : " (이미 올라가 있어 건너뜀)"}`);
    } else {
      lines.push(`${ICON[o.status]} ${o.label} — ${short(o.detail)}`);
    }
  }

  if (bad.length > 0) {
    lines.push("");
    // 🔴 이제 통째 재실행이 안전하다. post-log 에 채널별 게시 사실이 남아 있어
    // 이미 올라간 채널은 스스로 건너뛴다(중복 게시 없음).
    lines.push("🔁 재실행 — 안 올라간 것만 자동으로 다시 시도한다:");
    lines.push(`gh workflow run ${workflow}`);
    lines.push(`(특정 채널만 찍으려면: gh workflow run ${workflow} -f only=${bad.join(",")})`);
  }
  return lines.join("\n");
}

/**
 * 🔴 종전에 여기 있던 `runWithReport` 는 제거했다 (2026-09-02).
 *
 * 중복 방지(post-log 조회·기록)가 붙은 진입점은 `src/scripts/_run-channel.ts`
 * 의 `runChannel` 하나뿐이어야 한다. 중복 방지가 없는 래퍼를 남겨 두면
 * 새 채널을 붙일 때 그쪽을 부르게 되고, 그게 2026-09-01 삼중 게시의 구조다.
 * (작업76 에서 postMedia 를 비공개로 돌린 것과 같은 판단.)
 */

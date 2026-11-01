import { getCache } from "@vercel/functions";
import type { ResultsData } from "@/types/results";

/**
 * GH 중계기가 올린 라이브 스코어 보관소 (Vercel Runtime Cache).
 *
 * 🔴 왜 있는가: 2026-10-26 부터 네이버 스포츠 API 가 Vercel 요청에 응답하지 않는다.
 * GH 의 `src/scripts/live-relay.ts` 가 Chromium 으로 받아 `/api/live/ingest` 로 올린다.
 *
 * TTL 은 다음 배포까지 끝난 경기 스코어를 이어 줄 만큼 둔다(하루 4회 배포 = 6시간).
 * 낡은 LIVE 는 ScheduleCard 가 킥오프 시각으로 거른다.
 */
const KEY = "live-relay:results";
const TTL_SECONDS = 6 * 60 * 60;

export async function readRelayedLive(): Promise<ResultsData | null> {
  try {
    return ((await getCache().get(KEY)) as ResultsData | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function writeRelayedLive(data: ResultsData): Promise<void> {
  await getCache().set(KEY, data, { ttl: TTL_SECONDS, name: "live-relay" });
}

/** 라인업 원문 보관. lineup=축구, preview=야구. 매치 페이지 수명(14일)만큼 둔다. */
export type LineupKind = "lineup" | "preview";
const LINEUP_TTL_SECONDS = 14 * 24 * 60 * 60;

export async function readRelayedLineup(kind: LineupKind, gameId: string): Promise<string | null> {
  try {
    return ((await getCache().get(`live-relay:${kind}:${gameId}`)) as string | undefined) ?? null;
  } catch {
    return null;
  }
}

export async function writeRelayedLineup(kind: LineupKind, gameId: string, json: string): Promise<void> {
  await getCache().set(`live-relay:${kind}:${gameId}`, json, { ttl: LINEUP_TTL_SECONDS, name: "live-relay-lineup" });
}

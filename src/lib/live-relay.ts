import { getCache } from "@vercel/functions";
import type { ResultsData } from "@/types/results";

/**
 * 집 PC 가 올린 라이브 스코어 보관소 (Vercel Runtime Cache).
 *
 * 🔴 왜 있는가: 2026-10-26 부터 네이버 스포츠 API 가 Vercel·GH 요청에 응답하지 않는다.
 * 집 PC(`src/scripts/live-relay.ts`)가 대신 받아 `/api/live/ingest` 로 올린다.
 *
 * TTL 이 짧은 게 안전장치다. PC 가 꺼지면 값이 사라져 낡은 LIVE 가 남지 않는다.
 */
const KEY = "live-relay:results";
const TTL_SECONDS = 30 * 60;

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

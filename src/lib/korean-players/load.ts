import raw from "@/data/korean-players.json";
import type { KoreanPlayer, KoreanPlayersData } from "./types";

const data = raw as KoreanPlayersData;

/**
 * 로스터 유효기간(일).
 *
 * 🔴 낡은 로스터로 "이강인 출전"을 내보내는 것보다, 아무 말도 안 하는 쪽이 낫다.
 * 크롤이 며칠 이상 실패하면 로스터를 통째로 비워서 **선수 이름을 아예 안 쓰게** 한다
 * (히어로 가중치도 같이 빠진다 — 점수 손실은 감수하고 오보를 막는다).
 * 이적 시장은 하루면 정리되므로 여유를 크게 잡을 이유가 없다.
 */
export const ROSTER_MAX_AGE_DAYS = 10;

export function isRosterFresh(now: Date = new Date(), d: KoreanPlayersData = data): boolean {
  const t = Date.parse(d.generatedAt);
  if (!Number.isFinite(t)) return false;
  const ageDays = (now.getTime() - t) / 86_400_000;
  return ageDays >= 0 && ageDays <= ROSTER_MAX_AGE_DAYS;
}

/** 신선할 때만 로스터를 준다. 낡았으면 빈 배열. */
export function getKoreanPlayers(now: Date = new Date()): KoreanPlayer[] {
  return isRosterFresh(now) ? data.players : [];
}

export function rosterGeneratedAt(): string {
  return data.generatedAt;
}

export type { KoreanPlayer, KoreanPlayersData };

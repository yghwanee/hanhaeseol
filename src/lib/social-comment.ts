import type { Sport } from "@/types/schedule";
import { loadKoreanMatchesAll, pickHeroMatch, inferDayLabel } from "./instagram";
import { eventWord } from "./hero-pick";

const BRAND_URL = "haeseol.com";

const SPORT_EMOJI: Record<Sport, string> = {
  축구: "⚽",
  야구: "⚾",
  농구: "🏀",
  배구: "🏐",
};

/**
 * 게시 후 다는 첫 댓글. 매일 hero 매치업을 반영해 텍스트가 달라지도록 함.
 * 같은 채널이 동일 외부 링크 댓글을 매일 박는 패턴은 스팸 시그널이라
 * 본문은 매일 다르게 만들고 URL 한 줄만 고정.
 */
export function buildSocialComment(today: string): string {
  const games = loadKoreanMatchesAll(today);
  const hero = pickHeroMatch(games);
  const link = `📺 한국어 중계 편성표 👉 ${BRAND_URL}`;
  if (!hero) return link;

  const emoji = SPORT_EMOJI[hero.sport];
  const matchup = hero.awayTeam ? `${hero.homeTeam} vs ${hero.awayTeam}` : hero.homeTeam;
  const word = eventWord(hero);
  return `${inferDayLabel(today)} ${word} ${emoji} ${matchup}  ${hero.time}\n${link}`;
}

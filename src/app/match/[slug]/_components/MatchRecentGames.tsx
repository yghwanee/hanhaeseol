import type { RecentGame } from "@/lib/match-content/build";
import { TeamLogo } from "../../../_components/TeamLogo";

type Props = {
  homeTeam: string;
  awayTeam: string;
  homeRecent: RecentGame[];
  awayRecent: RecentGame[];
  /** schedule 표기 팀명 → 로고 URL (page.tsx의 findTeamLogo 전달) */
  logoFor: (name: string) => string | null;
};

function shortDate(iso: string): string {
  const [, m, d] = iso.split("-").map(Number);
  return `${m}/${d}`;
}

function ResultBadge({ result }: { result: RecentGame["result"] }) {
  const cls =
    result === "W"
      ? "bg-brand-subtle text-fg-brand-bright"
      : result === "L"
      ? "bg-[oklch(0.298_0.10_22_/_0.32)] text-fg-danger"
      : "bg-muted text-fg";
  const label = result === "W" ? "승" : result === "L" ? "패" : "무";
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-caption2 font-bold ${cls}`}
    >
      {label}
    </span>
  );
}

function GameRow({
  game,
  logoFor,
}: {
  game: RecentGame;
  logoFor: (name: string) => string | null;
}) {
  const homeLost = game.homeScore < game.awayScore;
  const awayLost = game.awayScore < game.homeScore;
  return (
    <li className="flex items-center gap-2 text-label1">
      <span className="w-9 shrink-0 font-mono text-caption1 text-fg-tertiary">
        {shortDate(game.date)}
      </span>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2">
        {/* 홈팀 — 엠블럼만 (팀명이 길면 행이 깨져서 이름은 생략) */}
        <div className="flex flex-1 items-center justify-end gap-1.5">
          <span className={homeLost ? "opacity-40" : ""}>
            <TeamLogo name={game.homeTeam} src={logoFor(game.homeTeam)} size={22} />
          </span>
        </div>

        {/* 스코어 (메인 카드 스타일: 진 쪽 흐리게) */}
        <div className="flex shrink-0 items-baseline gap-1 font-mono text-body1 font-bold leading-none sm:text-headline1">
          <span className={homeLost ? "text-fg-tertiary" : "text-fg-strong"}>
            {game.homeScore}
          </span>
          <span className="text-fg-tertiary">-</span>
          <span className={awayLost ? "text-fg-tertiary" : "text-fg-strong"}>
            {game.awayScore}
          </span>
        </div>

        {/* 원정팀 — 엠블럼만 */}
        <div className="flex flex-1 items-center justify-start gap-1.5">
          <span className={awayLost ? "opacity-40" : ""}>
            <TeamLogo name={game.awayTeam} src={logoFor(game.awayTeam)} size={22} />
          </span>
        </div>
      </div>

      <ResultBadge result={game.result} />
    </li>
  );
}

function TeamRecentCard({
  team,
  games,
  logoFor,
}: {
  team: string;
  games: RecentGame[];
  logoFor: (name: string) => string | null;
}) {
  return (
    <div className="flex-1 rounded-lg border border-line-subtle bg-surface p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <TeamLogo name={team} src={logoFor(team)} size={20} />
        <span className="truncate text-label1 font-semibold text-fg-strong">{team}</span>
      </div>
      {/* 호출부가 games.length > 0 일 때만 이 카드를 그린다 — 빈 문구 분기가 필요 없다. */}
      <ul className="space-y-1.5">
        {games.map((g, i) => (
          <GameRow key={`${g.date}-${i}`} game={g} logoFor={logoFor} />
        ))}
      </ul>
    </div>
  );
}

export function MatchRecentGames({
  homeTeam,
  awayTeam,
  homeRecent,
  awayRecent,
  logoFor,
}: Props) {
  // 양 팀 모두 데이터 없으면 섹션 자체를 숨김.
  if (homeRecent.length === 0 && awayRecent.length === 0) return null;

  return (
    <section className="mt-6">
      <div className="rounded-xl border border-line-subtle bg-subtle p-4 sm:p-5">
        <h2 className="mb-3 text-label1 font-semibold text-fg-strong sm:text-headline1">
          최근 5경기
        </h2>
        {/* 한쪽만 데이터가 있으면 그쪽만 그린다 — "준비 중입니다" 빈 카드를 만들지 않는다.
            섹션 전체가 빌 때는 위에서 이미 null 을 돌려준다. */}
        <div className="flex flex-col gap-2 sm:flex-row">
          {homeRecent.length > 0 && (
            <TeamRecentCard team={homeTeam} games={homeRecent} logoFor={logoFor} />
          )}
          {awayRecent.length > 0 && (
            <TeamRecentCard team={awayTeam} games={awayRecent} logoFor={logoFor} />
          )}
        </div>
      </div>
    </section>
  );
}

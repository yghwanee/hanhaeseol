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
      ? "bg-emerald-500/15 text-emerald-400"
      : result === "L"
      ? "bg-rose-500/15 text-rose-400"
      : "bg-zinc-600/20 text-zinc-300";
  const label = result === "W" ? "승" : result === "L" ? "패" : "무";
  return (
    <span
      className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-bold ${cls}`}
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
    <li className="flex items-center gap-2 text-sm">
      <span className="w-9 shrink-0 font-mono text-xs text-zinc-500">
        {shortDate(game.date)}
      </span>

      <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5 sm:gap-2">
        {/* 홈팀 */}
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5">
          <span
            className={`truncate text-xs sm:text-sm ${
              homeLost ? "text-zinc-500" : "text-zinc-100"
            }`}
          >
            {game.homeTeam}
          </span>
          <TeamLogo name={game.homeTeam} src={logoFor(game.homeTeam)} size={18} />
        </div>

        {/* 스코어 (메인 카드 스타일: 진 쪽 흐리게) */}
        <div className="flex shrink-0 items-baseline gap-1 font-mono text-base font-bold leading-none sm:text-lg">
          <span className={homeLost ? "text-zinc-500" : "text-zinc-100"}>
            {game.homeScore}
          </span>
          <span className="text-zinc-600">-</span>
          <span className={awayLost ? "text-zinc-500" : "text-zinc-100"}>
            {game.awayScore}
          </span>
        </div>

        {/* 원정팀 */}
        <div className="flex min-w-0 flex-1 items-center justify-start gap-1.5">
          <TeamLogo name={game.awayTeam} src={logoFor(game.awayTeam)} size={18} />
          <span
            className={`truncate text-xs sm:text-sm ${
              awayLost ? "text-zinc-500" : "text-zinc-100"
            }`}
          >
            {game.awayTeam}
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
    <div className="flex-1 rounded-lg border border-zinc-800/80 bg-zinc-900/40 p-3">
      <div className="mb-2 flex items-center gap-1.5">
        <TeamLogo name={team} src={logoFor(team)} size={20} />
        <span className="truncate text-sm font-semibold text-zinc-100">{team}</span>
      </div>
      {games.length > 0 ? (
        <ul className="space-y-1.5">
          {games.map((g, i) => (
            <GameRow key={`${g.date}-${i}`} game={g} logoFor={logoFor} />
          ))}
        </ul>
      ) : (
        <p className="text-xs text-zinc-500">최근 경기 결과 데이터를 준비 중입니다.</p>
      )}
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
      <div className="rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-4 sm:p-5">
        <h2 className="mb-3 text-sm font-semibold text-white sm:text-base">
          최근 5경기
        </h2>
        <div className="flex flex-col gap-2 sm:flex-row">
          <TeamRecentCard team={homeTeam} games={homeRecent} logoFor={logoFor} />
          <TeamRecentCard team={awayTeam} games={awayRecent} logoFor={logoFor} />
        </div>
      </div>
    </section>
  );
}

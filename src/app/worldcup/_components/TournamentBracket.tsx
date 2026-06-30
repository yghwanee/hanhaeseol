import { proxyLogo } from "@/lib/emblem";
import type { GameStatus } from "@/types/results";

export interface BracketMatch {
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  homeTeam: string;
  awayTeam: string;
  homeEmblem?: string;
  awayEmblem?: string;
  homeScore?: number;
  awayScore?: number;
  homePtScore?: number;
  awayPtScore?: number;
  winner?: "home" | "away";
  status: GameStatus;
}

export interface BracketRound {
  label: string; // "32강", "16강" ...
  matches: BracketMatch[];
}

function StatusPill({ status }: { status: GameStatus }) {
  if (status === "live")
    return (
      <span className="rounded-full bg-rose-500/15 px-1.5 py-0.5 text-[9px] font-bold text-rose-400">
        LIVE
      </span>
    );
  if (status === "finished")
    return <span className="text-[9px] font-medium text-zinc-500">종료</span>;
  if (status === "canceled")
    return <span className="text-[9px] font-medium text-zinc-500">취소</span>;
  if (status === "postponed")
    return <span className="text-[9px] font-medium text-zinc-500">연기</span>;
  return <span className="text-[9px] font-medium text-amber-300/70">예정</span>;
}

function TeamLine({
  name,
  emblem,
  score,
  isWinner,
  isLoser,
  showScore,
}: {
  name: string;
  emblem?: string;
  score?: number;
  isWinner: boolean;
  isLoser: boolean;
  showScore: boolean;
}) {
  const undecided = name === "미정" || !name;
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="flex min-w-0 items-center gap-1.5">
        {emblem ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={proxyLogo(emblem)}
            alt=""
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-3.5 w-5 shrink-0 rounded-[2px] object-cover"
          />
        ) : (
          <span className="h-3.5 w-5 shrink-0 rounded-[2px] bg-zinc-800" aria-hidden />
        )}
        <span
          className={`truncate text-xs sm:text-sm ${
            undecided
              ? "text-zinc-600"
              : isWinner
                ? "font-bold text-zinc-100"
                : isLoser
                  ? "text-zinc-500"
                  : "font-medium text-zinc-200"
          }`}
        >
          {undecided ? "미정" : name}
        </span>
      </span>
      {showScore && typeof score === "number" && (
        <span
          className={`shrink-0 font-mono text-sm font-bold tabular-nums ${
            isWinner ? "text-zinc-100" : isLoser ? "text-zinc-500" : "text-zinc-200"
          }`}
        >
          {score}
        </span>
      )}
    </div>
  );
}

function MatchCard({ m }: { m: BracketMatch }) {
  const showScore =
    (m.status === "finished" || m.status === "live") &&
    typeof m.homeScore === "number" &&
    typeof m.awayScore === "number";
  const winnerSide: "home" | "away" | null =
    m.status === "finished"
      ? (m.winner ??
        (typeof m.homeScore === "number" && typeof m.awayScore === "number"
          ? m.homeScore > m.awayScore
            ? "home"
            : m.awayScore > m.homeScore
              ? "away"
              : null
          : null))
      : null;
  const dateLabel = m.date.slice(5).replace("-", ".");
  const hasPk =
    typeof m.homePtScore === "number" && typeof m.awayPtScore === "number";

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2">
      <div className="mb-1 flex items-center justify-between text-[10px] text-zinc-500">
        <span>
          {dateLabel} {m.time}
        </span>
        <StatusPill status={m.status} />
      </div>
      <div className="space-y-1">
        <TeamLine
          name={m.homeTeam}
          emblem={m.homeEmblem}
          score={m.homeScore}
          isWinner={winnerSide === "home"}
          isLoser={winnerSide === "away"}
          showScore={showScore}
        />
        <TeamLine
          name={m.awayTeam}
          emblem={m.awayEmblem}
          score={m.awayScore}
          isWinner={winnerSide === "away"}
          isLoser={winnerSide === "home"}
          showScore={showScore}
        />
      </div>
      {hasPk && (
        <div className="mt-1 text-right text-[10px] font-semibold text-amber-300/90">
          승부차기 {m.homePtScore}-{m.awayPtScore}
        </div>
      )}
    </div>
  );
}

export function TournamentBracket({ rounds }: { rounds: BracketRound[] }) {
  const nonEmpty = rounds.filter((r) => r.matches.length > 0);
  if (nonEmpty.length === 0) {
    return (
      <p className="py-16 text-center text-sm text-zinc-500">
        토너먼트 대진이 아직 확정되지 않았습니다.
      </p>
    );
  }
  return (
    <div className="space-y-6">
      {nonEmpty.map((r) => (
        <section key={r.label}>
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-zinc-100">
            <span className="inline-block h-3.5 w-1 rounded-full bg-amber-400" aria-hidden />
            {r.label}
          </h3>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {r.matches.map((m, i) => (
              <MatchCard key={`${m.date}-${m.time}-${m.homeTeam}-${m.awayTeam}-${i}`} m={m} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

import type { StarterStat } from "@/types/starter";

interface Props {
  home: StarterStat | null;
  away: StarterStat | null;
  homeTeam: string;
  awayTeam: string;
}

function statLines(s: StarterStat): { primary: string; secondary: string } {
  // primary: 승패 + 이닝, secondary: 탈삼진 (+ WHIP 있으면)
  const primaryParts = [`${s.w}승 ${s.l}패`];
  if (s.ip) primaryParts.push(`${s.ip}이닝`);
  const secondaryParts = [`${s.so}K`];
  if (s.whip) secondaryParts.push(`WHIP ${s.whip}`);
  return { primary: primaryParts.join(" · "), secondary: secondaryParts.join(" · ") };
}

function StarterCol({
  team,
  starter,
  align,
}: {
  team: string;
  starter: StarterStat | null;
  align: "left" | "right";
}) {
  const alignCls = align === "right" ? "text-right" : "text-left";
  if (!starter) {
    return (
      <div className={`flex-1 ${alignCls}`}>
        <p className="truncate text-xs text-zinc-400 sm:text-sm">{team}</p>
        <p className="mt-1 text-sm text-zinc-600">선발 미발표</p>
      </div>
    );
  }
  const { primary, secondary } = statLines(starter);
  return (
    <div className={`flex-1 ${alignCls}`}>
      <p className="truncate text-xs text-zinc-400 sm:text-sm">{team}</p>
      <p className="mt-0.5 truncate text-base font-bold text-white sm:text-lg">{starter.name}</p>
      <p className="mt-1 text-sm font-semibold text-emerald-400">ERA {starter.era}</p>
      <p className="mt-0.5 text-[11px] text-zinc-400 sm:text-xs">{primary}</p>
      <p className="text-[11px] text-zinc-500 sm:text-xs">{secondary}</p>
    </div>
  );
}

export function MatchStarters({ home, away, homeTeam, awayTeam }: Props) {
  return (
    <section className="mt-4 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-5 sm:p-6">
      <h2 className="mb-3 text-center text-[11px] font-medium tracking-wide text-zinc-500 sm:text-xs">
        선발 매치업
      </h2>
      {!home && !away ? (
        <p className="text-center text-sm text-zinc-600">선발 미발표</p>
      ) : (
        <div className="flex items-start justify-center gap-4 sm:gap-6">
          <StarterCol team={homeTeam} starter={home} align="right" />
          <div className="self-center text-xs font-bold text-zinc-600 sm:text-sm">VS</div>
          <StarterCol team={awayTeam} starter={away} align="left" />
        </div>
      )}
    </section>
  );
}

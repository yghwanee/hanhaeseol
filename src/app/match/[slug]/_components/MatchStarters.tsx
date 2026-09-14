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
        <p className="truncate text-caption1 text-fg-secondary sm:text-label1">{team}</p>
        <p className="mt-1 text-label1 text-fg-secondary">선발 미발표</p>
      </div>
    );
  }
  const { primary, secondary } = statLines(starter);
  return (
    <div className={`flex-1 ${alignCls}`}>
      <p className="truncate text-caption1 text-fg-secondary sm:text-label1">{team}</p>
      <p className="mt-0.5 truncate text-body1 font-bold text-fg-strong sm:text-headline1">{starter.name}</p>
      <p className="mt-1 text-label1 font-semibold text-fg-brand-bright">ERA {starter.era}</p>
      <p className="mt-0.5 text-caption2 text-fg-secondary sm:text-caption1">{primary}</p>
      <p className="text-caption2 text-fg-tertiary sm:text-caption1">{secondary}</p>
    </div>
  );
}

export function MatchStarters({ home, away, homeTeam, awayTeam }: Props) {
  return (
    <section className="mt-4 rounded-xl border border-line-subtle bg-subtle p-5 sm:p-6">
      <h2 className="mb-3 text-center text-caption2 font-medium tracking-wide text-fg-tertiary sm:text-caption1">
        선발 매치업
      </h2>
      {!home && !away ? (
        <p className="text-center text-label1 text-fg-secondary">선발 미발표</p>
      ) : (
        <div className="flex items-start justify-center gap-4 sm:gap-6">
          <StarterCol team={homeTeam} starter={home} align="right" />
          <div className="self-center text-caption1 font-bold text-fg-tertiary sm:text-label1">VS</div>
          <StarterCol team={awayTeam} starter={away} align="left" />
        </div>
      )}
    </section>
  );
}

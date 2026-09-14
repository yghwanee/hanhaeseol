import { LeagueGuide } from "@/lib/league-guides";

type Props = {
  guide: LeagueGuide;
  display: string;
};

export default function LeagueGuideSection({ guide, display }: Props) {
  return (
    <section className="mb-6 rounded-xl border border-line bg-surface p-4 sm:p-5">
      <h2 className="text-base sm:text-lg font-semibold text-fg-strong mb-4">
        {display} 시청 가이드
      </h2>

      <dl className="space-y-3 text-sm">
        {guide.season && (
          <div className="flex gap-3">
            <dt className="text-fg-tertiary shrink-0 w-20 sm:w-24">시즌</dt>
            <dd className="text-fg">{guide.season}</dd>
          </div>
        )}
        {guide.broadcasters && guide.broadcasters.length > 0 && (
          <div className="flex gap-3">
            <dt className="text-fg-tertiary shrink-0 w-20 sm:w-24">한국 중계</dt>
            <dd className="text-fg">{guide.broadcasters.join(", ")}</dd>
          </div>
        )}
        {guide.koreanCommentary && (
          <div className="flex gap-3">
            <dt className="text-fg-tertiary shrink-0 w-20 sm:w-24">한국어 해설</dt>
            <dd className="text-fg">{guide.koreanCommentary}</dd>
          </div>
        )}
        {guide.gameTime && (
          <div className="flex gap-3">
            <dt className="text-fg-tertiary shrink-0 w-20 sm:w-24">경기 시간</dt>
            <dd className="text-fg">{guide.gameTime}</dd>
          </div>
        )}
        {guide.notableTeams && guide.notableTeams.length > 0 && (
          <div className="flex gap-3">
            <dt className="text-fg-tertiary shrink-0 w-20 sm:w-24">주요 팀</dt>
            <dd className="text-fg">{guide.notableTeams.join(", ")}</dd>
          </div>
        )}
      </dl>

      {guide.highlights && guide.highlights.length > 0 && (
        <div className="mt-4 pt-3 border-t border-line-subtle">
          <p className="text-xs text-fg-tertiary mb-2">관전 포인트</p>
          <ul className="space-y-1">
            {guide.highlights.map((h, i) => (
              <li
                key={i}
                className="text-xs sm:text-sm text-fg-secondary flex items-start gap-1.5"
              >
                <span className="text-fg-tertiary mt-0.5">•</span>
                {h}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

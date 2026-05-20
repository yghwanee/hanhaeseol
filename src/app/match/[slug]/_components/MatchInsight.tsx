import type { MatchInsight } from "@/types/match-insight";

export function MatchInsightSection({ insight }: { insight: MatchInsight }) {
  const { sections, generatedAt } = insight;

  return (
    <section className="caps-stripe-section mt-6 border border-zinc-800/80 bg-zinc-950/40 p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <span className="text-sm">✨</span>
        <h2 className="text-base font-semibold text-white sm:text-lg">
          경기 미리보기
        </h2>
      </header>

      <h3 className="text-lg font-bold text-white sm:text-xl">
        {sections.headline}
      </h3>

      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-300">
        <Block title="최근 폼" body={sections.recentForm} />
        <Block title="핵심 매치업" body={sections.keyMatchup} />

        <div>
          <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            관전 포인트
          </h4>
          <ul className="mt-2 space-y-1.5">
            {sections.watchPoints.map((p, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-zinc-600">·</span>
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>

        <Block title="시청 안내" body={sections.viewingInfo} />
      </div>
    </section>
  );
}

function Block({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
        {title}
      </h4>
      <p className="mt-1.5">{body}</p>
    </div>
  );
}

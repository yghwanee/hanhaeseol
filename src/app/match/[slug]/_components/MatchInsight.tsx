import type { MatchInsight } from "@/types/match-insight";

export function MatchInsightSection({ insight }: { insight: MatchInsight }) {
  const { sections, generatedAt } = insight;

  return (
    <section className="mt-6 rounded-xl border border-zinc-800/80 bg-zinc-950/40 p-5 sm:p-6">
      <header className="mb-4 flex items-center gap-2">
        <span className="text-sm">✨</span>
        <h2 className="text-base font-semibold text-white sm:text-lg">
          AI 관전 포인트
        </h2>
      </header>

      <h3 className="text-lg font-bold text-white sm:text-xl">
        {sections.headline}
      </h3>

      <div className="mt-4 space-y-4 text-sm leading-relaxed text-zinc-300">
        <Block title="최근 폼" body={sections.recentForm} />
        <Block title="핵심 매치업" body={sections.keyMatchup} />

        {/* AdSense in-article slot */}
        <div
          className="my-4 min-h-[100px] rounded-md border border-dashed border-zinc-800/60 bg-zinc-950/30 px-3 py-4 text-center text-xs text-zinc-600"
          data-ad-slot="match-insight-inarticle"
          aria-label="광고 영역"
        >
          {/* AdSense unit injected by existing global ad loader */}
          광고
        </div>

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

      <footer className="mt-5 border-t border-zinc-800/60 pt-3 text-[11px] text-zinc-600">
        AI 보조 작성 · 베팅 추천 아님 · 한국어 해설 안내 목적 ·{" "}
        <time dateTime={generatedAt}>
          {new Date(generatedAt).toLocaleDateString("ko-KR")} 생성
        </time>
      </footer>
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

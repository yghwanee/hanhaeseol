import type { MatchInsight } from "@/types/match-insight";

export function MatchInsightSection({ insight }: { insight: MatchInsight }) {
  const { sections } = insight;

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
      </div>

      {/* 생성 방식 고지.
          Google 의 helpful-content 가이드는 "How was it created?" 를 평가 항목으로 두고,
          **AI 보조 콘텐츠에는 과정 공개를 기대한다**고 명시한다. 이 섹션은 편성·기록
          데이터를 근거로 LLM 이 쓴 문장이고 사람이 문장 단위로 손보지 않으므로, 그 사실을
          그대로 적는다. "운영자가 검수합니다" 같은 문구는 실제로 하지 않는 일이라 쓰지 않는다. */}
      <p className="mt-5 border-t border-zinc-800/80 pt-3 text-xs leading-relaxed text-zinc-500">
        이 미리보기는 한해설이 수집한 편성·순위·최근 경기 기록을 근거로 AI가 작성한
        자동 생성 문장입니다. 사실관계는 각 리그·플랫폼 공식 발표를 따릅니다.
        {insight.generatedAt && (
          <>
            {" "}생성{" "}
            <time dateTime={insight.generatedAt}>
              {insight.generatedAt.slice(0, 10).replace(/-/g, ".")}
            </time>
          </>
        )}
      </p>
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
